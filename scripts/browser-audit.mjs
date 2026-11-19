import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {readFile, writeFile, mkdir, mkdtemp, rm} from "node:fs/promises";
import {join, resolve} from "node:path";
import {tmpdir} from "node:os";
import {pathToFileURL} from "node:url";

const output=resolve("reports/browser");
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
async function capture(name,full=false){
 const x=await call("Page.captureScreenshot",{format:"png",captureBeyondViewport:full,fromSurface:true});
 const buf=Buffer.from(x.result.data,"base64");
 assert.ok(buf.length>2000,"Screenshot unexpectedly empty: "+name);
 await writeFile(join(output,name),buf);
 report.screenshots.push({name,size_bytes:buf.length});
}
const URL=pathToFileURL(resolve("index.html")).href;
async function viewport(width,height,reduce=false){
 await call("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:width<=800});
 await call("Emulation.setEmulatedMedia",{media:"screen",features:[{name:"prefers-reduced-motion",value:reduce?"reduce":"no-preference"}]});
 await call("Page.navigate",{url:URL});
 await until(async()=>await js("document.readyState==='complete' && !!document.querySelector('.hero--motion')"),"page render");
 await sleep(130);
 const diag=await js(`(()=>{
 const viewport=document.documentElement.clientWidth;
 const logo=[...document.images].map(x=>({src:x.getAttribute('src'),complete:x.complete,naturalWidth:x.naturalWidth,naturalHeight:x.naturalHeight}));
 const text=[...document.querySelectorAll('.motion-line, .statement h2, .contact h2')].map(el=>{
  const r=document.createRange();r.selectNodeContents(el);
  return {text:el.innerText,contentWidth:Math.round(r.getBoundingClientRect().width),visibleWidth:Math.round(el.getBoundingClientRect().width),clientWidth:el.clientWidth,scrollWidth:el.scrollWidth};
 });
 const nodes=[...document.querySelectorAll('body *')].filter(el=>{
  const s=getComputedStyle(el),r=el.getBoundingClientRect();
  return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.left < -2 || (s.display!=='none'&&s.visibility!=='hidden'&&r.right>viewport+2&&r.width>0);
 }).slice(0,12).map(el=>({tag:el.tagName,className:typeof el.className==='string'?el.className.slice(0,70):'',right:Math.round(el.getBoundingClientRect().right),left:Math.round(el.getBoundingClientRect().left)}));
 return {viewport,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,logo,text,offscreen:nodes,navDisplay:getComputedStyle(document.querySelector('.main-nav')).display,animation:getComputedStyle(document.querySelector('.motion-line__inner')).animationName};
})()`);
 const fails=[];
 if(diag.scrollWidth>width+2)fails.push("horizontal scroll "+diag.scrollWidth+" > "+width);
 if(diag.text.some(t=>t.contentWidth>t.visibleWidth+2))fails.push("clipped hero headline");
 if(diag.logo.some(x=>!x.complete||x.naturalWidth===0))fails.push("broken image");
 if(diag.offscreen.some(x=>!x.className.includes("skip-link") && !x.className.includes("hero-symbol-echoes") && !x.className.includes("hero-stage") && !x.className.includes("art-")))fails.push("element off-screen: "+JSON.stringify(diag.offscreen));
 if(reduce&&diag.animation!=="none")fails.push("reduced motion did not disable animation");
 report.viewports.push({width,height,reduce,...diag,failures:fails});
 report.failures.push(...fails.map(x=>width+": "+x));
 return diag;
}
try{
 // Chromium can initialize asynchronously on cold GitHub runners.
 await sleep(1400);
 const target=await call("Target.createTarget",{url:"about:blank"},false);
 const attached=await call("Target.attachToTarget",{targetId:target.result.targetId,flatten:true},false);
 sessionId=attached.result.sessionId;
 if(!sessionId)throw new Error("CDP attach returned no session");
 await call("Page.enable");
 await call("Runtime.enable");
 const d=await viewport(1440,900);
 await capture("desktop-entry.png");
 await sleep(1100);
 await capture("desktop-transition.png");
 await sleep(2050);
 await capture("desktop-final.png");
 await capture("desktop-full.png",true);
 assert.equal(d.logo.length>=4,true,"Expected original brand mark and concept artwork");
 for(const [w,h] of [[1024,768],[768,900],[390,844],[320,700]]){
  await viewport(w,h);
  if(w===390){
   await sleep(3200);
   await capture("mobile-final.png");
   await capture("mobile-full.png",true);
   await js("document.querySelector('.menu-button').click()");
   const menu=await js("({expanded:document.querySelector('.menu-button').getAttribute('aria-expanded'),display:getComputedStyle(document.querySelector('.main-nav')).display})");
   if(menu.expanded!=="true"||menu.display==="none")report.failures.push("Mobile navigation did not open");
   await call("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
   await call("Input.dispatchKeyEvent",{type:"keyUp",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
   const after=await js("({expanded:document.querySelector('.menu-button').getAttribute('aria-expanded'),focused:document.activeElement===document.querySelector('.menu-button')})");
   if(after.expanded!=="false"||!after.focused)report.failures.push("Escape did not close and focus mobile menu");
   report.tests.push({name:"mobile navigation + Escape",menu,after});
  }
 }
 const reduced=await viewport(390,844,true);
 await capture("mobile-reduced-motion.png");
 report.tests.push({name:"reduced motion",animation:reduced.animation});
}catch(e){report.failures.push("runner: "+String(e.stack||e));}
finally{
 await writeFile(join(output,"audit.json"),JSON.stringify(report,null,2));
 if(child.stdio[3])child.stdio[3].end();
 child.kill("SIGTERM");
 await sleep(80);
 await rm(profile,{recursive:true,force:true}).catch(()=>{});
}
if(report.failures.length){
 console.error("DESSET browser audit FAIL\n"+report.failures.join("\n"));
 process.exitCode=1;
}else console.log("DESSET browser audit PASS: "+report.viewports.length+" render states, "+report.screenshots.length+" screenshots, menu and reduced motion.");
