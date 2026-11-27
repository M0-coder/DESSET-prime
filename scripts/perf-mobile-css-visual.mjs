import {spawn} from "node:child_process";
import {writeFile,mkdtemp,rm} from "node:fs/promises";
import {join,resolve} from "node:path";
import {tmpdir} from "node:os";
const output=resolve("reports/perf-css"),variant=process.argv[2];
if(!["A","B"].includes(variant))throw Error("Unknown variant");
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

try{
 const target=await call("Target.createTarget",{url:"about:blank"},false);
 const attached=await call("Target.attachToTarget",{targetId:target.result.targetId,flatten:true},false);
 sessionId=attached.result.sessionId;
 await call("Page.enable");
 await call("Runtime.enable");
 await call("Network.enable");
 await call("Network.setCacheDisabled",{cacheDisabled:true});
 for(const width of [320,390,768,1024,1440]){
  await call("Emulation.setDeviceMetricsOverride",{width,height:width<800?844:900,deviceScaleFactor:1,mobile:width<=800});
  await call("Emulation.setEmulatedMedia",{media:"screen",features:[{name:"prefers-reduced-motion",value:"reduce"}]});
  await call("Page.navigate",{url:"http://127.0.0.1:4173/"});
  await until(async()=>await js("location.origin==='http://127.0.0.1:4173' && document.readyState==='complete' && !!document.querySelector('#inicio')"),"render");
  await js("document.fonts.ready");
  await until(async()=>await js("document.querySelector('#inicio img.prime-photo-image')?.complete && document.querySelector('#inicio img.prime-photo-image')?.naturalWidth>0"),"hero poster");
  await sleep(500);
  const state=await js(`(()=>{const capture=(e,p)=>{const s=getComputedStyle(e,p);return [...s].map(k=>[k,s.getPropertyValue(k)])};return [...document.querySelectorAll('body,body *')].map(e=>{const r=e.getBoundingClientRect();return {tag:e.tagName,rect:[r.x,r.y,r.width,r.height],style:capture(e,null),before:capture(e,'::before'),after:capture(e,'::after')};})})()`);
  await writeFile(join(output,variant+"-"+width+".json"),JSON.stringify(state));
  const shot=await call("Page.captureScreenshot",{format:"png",fromSurface:true});
  await writeFile(join(output,variant+"-"+width+".png"),Buffer.from(shot.result.data,"base64"));
 }
}finally{
 child.kill();
 await new Promise(r=>{if(child.exitCode!==null)r();else child.once("exit",r)});
 await rm(profile,{recursive:true,force:true});
}
