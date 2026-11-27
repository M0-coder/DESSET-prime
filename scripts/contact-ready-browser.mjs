import {spawn} from "node:child_process";
import {writeFile,mkdtemp,rm,mkdir} from "node:fs/promises";
import {join,resolve} from "node:path";
import {tmpdir} from "node:os";
import {pathToFileURL} from "node:url";
import assert from "node:assert/strict";
const output=resolve("reports/contact-ready");
await mkdir(output,{recursive:true});
const profile=await mkdtemp(join(tmpdir(),"desset-chrome-"));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const child=spawn(process.env.CHROME_BIN||"google-chrome",[
 "--headless=new","--no-sandbox","--disable-gpu","--disable-dev-shm-usage",
 "--no-first-run","--no-default-browser-check","--disable-background-networking",
 "--remote-debugging-pipe","--user-data-dir="+profile,"about:blank"
],{stdio:["ignore","ignore","pipe","pipe","pipe"],env:{...process.env,DBUS_SESSION_BUS_ADDRESS:"",DBUS_SYSTEM_BUS_ADDRESS:""}});
let chromeError="";
child.stderr.on("data",b=>{chromeError+=String(b).slice(-900)});
let requestId=0,sessionId=null,pipeBuffer="";
const pending=new Map();
const report={timestamp:new Date().toISOString(),viewports:[],screenshots:[],tests:[],failures:[]};
async function until(fn,label){
 for(let i=0;i<110;i++){
  if(child.exitCode!==null)throw new Error("Chrome exited during "+label+": "+chromeError.slice(-500));
  try{const v=await fn();if(v)return v}catch{}
  await sleep(100);
 }
 throw new Error("Timeout waiting for "+label+"; Chrome stderr: "+chromeError.slice(-1200));
}
child.stdio[4].on("data",chunk=>{
 pipeBuffer+=chunk.toString();
 let pos;
 while((pos=pipeBuffer.indexOf("\0"))!==-1){
  const frame=pipeBuffer.slice(0,pos);pipeBuffer=pipeBuffer.slice(pos+1);
  if(!frame)continue;
  let msg;try{msg=JSON.parse(frame)}catch(e){chromeError+=" CDP parse error: "+String(e);continue}
  if(!msg.id)continue;
  const pendingCall=pending.get(msg.id);if(!pendingCall)continue;
  clearTimeout(pendingCall.timeout);pending.delete(msg.id);
  if(msg.error)pendingCall.reject(new Error(msg.error.message));
  else pendingCall.accept(msg);
 }
});
function call(method,params={},page=true){
 const id=++requestId;
 return new Promise((accept,reject)=>{
  const timeout=setTimeout(()=>{pending.delete(id);reject(new Error("CDP timeout "+method+"; Chrome stderr: "+chromeError.slice(-400)))},25000);
  pending.set(id,{accept,reject,timeout});
  const msg={id,method,params};
  if(page&&sessionId)msg.sessionId=sessionId;
  child.stdio[3].write(JSON.stringify(msg)+"\0");
 });
}
async function js(expression){
 const response=await call("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
 if(response.exceptionDetails)throw new Error("Browser evaluation failed: "+JSON.stringify(response.exceptionDetails));
 return response.result.result.value;
}

const entry=pathToFileURL(resolve("internal/contact-ready/index.html")).href;
const ids=["alianzas","inversion","marketing","prensa","instituciones","profesionales","legal","seguridad","otras"];
const checks=[];
try{
 const target=await call("Target.createTarget",{url:"about:blank"},false);
 const attached=await call("Target.attachToTarget",{targetId:target.result.targetId,flatten:true},false);
 sessionId=attached.result.sessionId;await call("Page.enable");await call("Runtime.enable");
 for(const width of [320,390,768,1440]){
  await call("Emulation.setDeviceMetricsOverride",{width,height:900,deviceScaleFactor:1,mobile:width<=800});
  await call("Page.navigate",{url:entry});
  await until(async()=>await js("location.href==="+JSON.stringify(entry)+" && document.readyState==='complete' && !document.querySelector('.ct-send').disabled"),"directory");
  await js("document.fonts.ready");
  assert.equal(await js("document.querySelectorAll('#directorio .ct-item').length"),9);
  assert.ok(await js("document.documentElement.scrollWidth<=document.documentElement.clientWidth+2"));
  const screenshot=async name=>{const s=await call("Page.captureScreenshot",{format:"png",fromSurface:true});await writeFile(join(output,name+".png"),Buffer.from(s.result.data,"base64"));};
  await screenshot("directory-"+width);
  for(const id of ids){
   await js("location.hash="+JSON.stringify("consulta-"+id));
   await until(async()=>await js("!document.getElementById('form-view').hidden && document.getElementById('crumb').textContent===document.getElementById("+JSON.stringify(id)+").querySelector('span').textContent"),"category "+id);
   assert.ok(await js("document.documentElement.scrollWidth<=document.documentElement.clientWidth+2 && !document.getElementById('demo-form').checkValidity()"));
   assert.equal(await js("document.getElementById('phone').disabled"),!["prensa","alianzas","marketing","instituciones"].includes(id));
   assert.equal(await js("document.getElementById('org').disabled"),["seguridad","otras","profesionales"].includes(id));
   if(id==="marketing")await screenshot("marketing-"+width);
   await js(`(()=>{for(const [k,v] of Object.entries({person:'Persona ficticia',email:'qa@example.com',subject:'Prueba',message:'Texto ficticio'})){document.getElementById(k).value=v}document.getElementById('message').dispatchEvent(new Event('input'));document.getElementById('consent').checked=true;})()`);
   assert.equal(await js("document.getElementById('count').textContent"),"14 / 2000 caracteres");
   assert.ok(await js("document.getElementById('demo-form').checkValidity()"));
   await js("document.getElementById('demo-form').requestSubmit()");
   assert.ok(await js("!document.getElementById('demo-result').hidden && document.getElementById('person').value==='' && document.getElementById('message').value===''"));
   await js("location.hash='directorio'");
   await until(async()=>await js("!document.getElementById('directorio').hidden && document.getElementById('form-view').hidden"),"return");
   checks.push({width,id,pass:true});
  }
 }
 await writeFile(join(output,"checks.json"),JSON.stringify(checks,null,2));console.log("CONTACT-READY PASS: "+checks.length+" category/viewport simulations, no network intake");
}finally{child.kill();await new Promise(r=>{if(child.exitCode!==null)r();else child.once("exit",r)});await rm(profile,{recursive:true,force:true});}
