import {spawn} from "node:child_process";
import {writeFile,mkdtemp,rm,mkdir} from "node:fs/promises";
import {join,resolve} from "node:path";
import {tmpdir} from "node:os";
import {startFixture} from "./contact-e2e-fixture.mjs";
import assert from "node:assert/strict";
const d1=process.argv.includes("--d1");
const output=resolve(d1?"reports/contact-e2e/d1":"reports/contact-e2e/legacy");
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


let fixture;
const ids=["alianzas","inversion","marketing","prensa","instituciones","profesionales","legal","seguridad","otras"],checks=[];
try{
 fixture=await startFixture({d1});
 const entry=fixture.origin+"/internal/contact-ready/index.html";
 const target=await call("Target.createTarget",{url:"about:blank"},false);
 const attached=await call("Target.attachToTarget",{targetId:target.result.targetId,flatten:true},false);
 sessionId=attached.result.sessionId;await call("Page.enable");await call("Runtime.enable");await call("Network.enable");
 const auth=async token=>call("Network.setExtraHTTPHeaders",{headers:token?{"X-Fixture-Admin":token}:{}});
 const nav=async url=>{await call("Page.navigate",{url});await until(async()=>await js("location.href==="+JSON.stringify(url)+" && document.readyState==='complete'"),"navigation");};
 const screenshot=async name=>{const s=await call("Page.captureScreenshot",{format:"png",fromSurface:true});await writeFile(join(output,name+".png"),Buffer.from(s.result.data,"base64"));};
 let sequence=0;
 for(const width of [320,390,768,1440]){
  await call("Emulation.setDeviceMetricsOverride",{width,height:900,deviceScaleFactor:1,mobile:width<=800});
  for(const category of ids){
   await auth(null);await nav(entry+"#consulta-"+category);
   await until(async()=>await js("!document.getElementById('form-view').hidden&&!document.querySelector('.ct-send').disabled"),"form ready");
   const email="synthetic"+(++sequence)+"@example.invalid";
   await js("(()=>{const values="+JSON.stringify({person:"Synthetic Person",email,subject:"Synthetic subject",message:"Synthetic message",org:"Synthetic Organization",phone:"+51900000000"})+";for(const [k,v] of Object.entries(values)){const f=document.getElementById(k);if(!f.disabled)f.value=v}document.getElementById('consent').checked=true;document.getElementById('message').dispatchEvent(new Event('input'));})()");
   assert.ok(await js("document.getElementById('demo-form').checkValidity()"));
   await js("document.getElementById('demo-form').requestSubmit()");
   await until(async()=>await js("!document.getElementById('demo-result').hidden && !!document.getElementById('demo-result').dataset.receipt"),"receipt");
   const id=await js("document.getElementById('demo-result').dataset.receipt");
   assert.equal((await fixture.db.prepare("SELECT category,state,email FROM contact_requests WHERE id=?").get(id)).category,category);
   assert.equal((await fixture.db.prepare("SELECT email FROM contact_requests WHERE id=?").get(id)).email,email);
   if(category==="marketing")await screenshot("receipt-"+width);
   await auth(null);await nav(fixture.origin+"/panel/request/"+id);
   assert.match(await js("document.body.innerText"),/Acceso o solicitud no disponible/);
   await auth(fixture.admin);await nav(fixture.origin+"/panel?category="+category);
   assert.ok(await js("!!document.querySelector('a[href="+JSON.stringify("/panel/request/"+id)+"]')"));
   assert.ok(await js("!document.body.innerText.includes("+JSON.stringify(email)+")"));
   await nav(fixture.origin+"/panel/request/"+id);
   assert.ok(await js("document.body.innerText.includes("+JSON.stringify(email)+") && document.documentElement.scrollWidth<=document.documentElement.clientWidth+2"));
   if(category==="marketing")await screenshot("panel-"+width);
   await js("document.querySelector('form button').click()");
   await until(async()=>{const last=fixture.transitions.at(-1);if(last&&last.status!==303)return true;return await js("document.readyState==='complete' && document.querySelector('form button')?.textContent==='Cerrar consulta'");},"review");
   assert.equal(fixture.transitions.at(-1)?.status,303,"review response "+JSON.stringify(fixture.transitions.at(-1)));
   assert.equal(await js("document.querySelector('form button')?.textContent"),"Cerrar consulta");
   await js("document.querySelector('form button').click()");
   await until(async()=>await js("document.readyState==='complete' && document.body.innerText.includes('Consulta cerrada.')"),"close");
   const row=await fixture.db.prepare("SELECT state,version FROM contact_requests WHERE id=?").get(id);
   assert.equal(row.state,"CLOSED");assert.equal(row.version,2);
   assert.equal((await fixture.db.prepare("SELECT count(*) n FROM contact_events WHERE request_id=?").get(id)).n,2);
   checks.push({width,category,pass:true});
  }
 }
 // Negative controls: privilege separation, synthetic-only, challenge denial and shutdown.
 await auth(fixture.restricted);await nav(fixture.origin+"/panel?category=legal");assert.match(await js("document.body.innerText"),/Acceso o solicitud no disponible/);
 await auth(null);
 const bad=await fetch(fixture.origin+"/api/contact",{method:"POST",headers:{Origin:fixture.origin,"Content-Type":"application/json"},body:JSON.stringify({category:"marketing",person:"Not synthetic",email:"not-synthetic@example.invalid",organization:"",phone:"",subject:"Synthetic subject",message:"Synthetic message",consent:true,privacyVersion:"synthetic-v1",requestKey:"a".repeat(64),challenge:"synthetic-test"})});assert.equal(bad.status,400);
 fixture.challenge(false);
 const denied=await fetch(fixture.origin+"/api/contact",{method:"POST",headers:{Origin:fixture.origin,"Content-Type":"application/json"},body:JSON.stringify({category:"marketing",person:"Synthetic Person",email:"synthetic999@example.invalid",organization:"",phone:"",subject:"Synthetic subject",message:"Synthetic message",consent:true,privacyVersion:"synthetic-v1",requestKey:"b".repeat(64),challenge:"synthetic-test"})});assert.equal(denied.status,403);
 assert.equal((await fixture.db.prepare("SELECT count(*) n FROM contact_requests").get()).n,36);assert.equal((await fixture.db.prepare("SELECT count(*) n FROM contact_events").get()).n,72);
 assert.equal(await fixture.purge(),36);assert.equal((await fixture.db.prepare("SELECT count(*) n FROM contact_events").get()).n,0);
 fixture.disable();assert.equal((await fetch(fixture.origin+"/panel")).status,503);
 await writeFile(join(output,"checks.json"),JSON.stringify({checks,negativeControls:["unauthenticated","department","synthetic-only","challenge","expiry","disabled"],rowsAfterPurge:0,eventsAfterPurge:0},null,2));
 assert.equal(fixture.transitions.length,72);assert.ok(fixture.transitions.every(t=>t.status===303&&t.origin==="same-origin"&&t.authorized));
 console.log((d1?"CONTACT-INTEGRATION-03B D1 PASS: ":"CONTACT-READY-04 PASS: ")+checks.length+" full browser circuits, 72 audit transitions, purge and negative controls");
}catch(e){if(fixture){await writeFile(join(output,"transition-diagnostics.json"),JSON.stringify(fixture.transitions,null,2));console.error("Synthetic transition diagnostics",JSON.stringify(fixture.transitions));}throw e;
}finally{
 child.kill();await new Promise(r=>{if(child.exitCode!==null)r();else child.once("exit",r)});
 try{await rm(profile,{recursive:true,force:true,maxRetries:12,retryDelay:250});}finally{if(fixture)await fixture.close();}
}
