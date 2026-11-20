/** GPU proof: real Three.js canvas and triangles through Chromium software WebGL2.
 * NO deployment; uses only HTTP loopback and pinned local bundled JS. */
import assert from "node:assert/strict";
import {spawn} from "node:child_process";
import {mkdir,writeFile,mkdtemp,rm} from "node:fs/promises";
import {resolve,join} from "node:path";
import {tmpdir} from "node:os";

const out=resolve("reports/gpu");
await mkdir(out,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const server=spawn(process.execPath,["scripts/local-preview.mjs"],{stdio:["ignore","pipe","pipe"]});
let serverLogs="";
for(const stream of [server.stdout,server.stderr])stream.on("data",b=>{serverLogs+=String(b).slice(-800)});
const profile=await mkdtemp(join(tmpdir(),"desset-webgl-"));
const chrome=spawn(process.env.CHROME_BIN||"google-chrome",[
 "--headless=new","--no-sandbox","--disable-dev-shm-usage",
 "--enable-unsafe-swiftshader","--use-gl=angle","--use-angle=swiftshader",
 "--enable-webgl","--disable-gpu-sandbox",
 "--no-first-run","--disable-background-networking",
 "--remote-debugging-pipe","--user-data-dir="+profile,"about:blank"
],{stdio:["ignore","ignore","pipe","pipe","pipe"],env:{...process.env,DBUS_SESSION_BUS_ADDRESS:"",DBUS_SYSTEM_BUS_ADDRESS:""}});
let chromeError="";
chrome.stderr.on("data",b=>{chromeError+=String(b).slice(-1300)});
let nextId=0,sessionId=null,buffer="";
const pending=new Map(),failures=[],checks=[],captures=[];
chrome.stdio[4].on("data",chunk=>{
 buffer+=String(chunk);let end;
 while((end=buffer.indexOf("\0"))!==-1){
  const str=buffer.slice(0,end);buffer=buffer.slice(end+1);
  if(!str)continue;
  let msg;try{msg=JSON.parse(str)}catch{continue}
  if(!msg.id)continue;
  const p=pending.get(msg.id);if(!p)continue;pending.delete(msg.id);clearTimeout(p.timer);
  if(msg.error)p.reject(Error(String(msg.error.message)));else p.resolve(msg);
 }
});
function send(method,params={},page=true){
 return new Promise((resolve,reject)=>{
  const id=++nextId;
  const timer=setTimeout(()=>{pending.delete(id);reject(Error("CDP timeout "+method))},25000);
  pending.set(id,{timer,resolve,reject});
  const msg={id,method,params};
  if(page&&sessionId)msg.sessionId=sessionId;
  chrome.stdio[3].write(JSON.stringify(msg)+"\0");
 });
}
async function evalJS(expression){
 const x=await send("Runtime.evaluate",{expression,returnByValue:true,awaitPromise:true});
 if(x.result?.exceptionDetails)throw Error("Eval failed "+JSON.stringify(x.result.exceptionDetails));
 return x.result.result.value;
}
async function waitUntil(label,predicate,timeoutMs=10000){
 const started=Date.now();let last;
 while(Date.now()-started<timeoutMs){
  last=await predicate();if(last)return last;
  await sleep(100);
 }
 throw Error("Timeout "+label+" "+JSON.stringify(last)+" "+chromeError.slice(-380));
}
async function screenshot(name){
 const x=await send("Page.captureScreenshot",{format:"png",fromSurface:true,captureBeyondViewport:false});
 const data=Buffer.from(x.result.data,"base64");
 assert.ok(data.length>3000,name+" empty screenshot");
 await writeFile(join(out,name),data);captures.push({name,bytes:data.length});
}
const check=(name,pass,metadata={})=>{
 checks.push({name,pass:Boolean(pass),...metadata});
 if(!pass)failures.push(name+" "+JSON.stringify(metadata));
};
async function viewport(width,height,reduce=false){
 await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:width<801});
 await send("Emulation.setEmulatedMedia",{media:"screen",features:[{name:"prefers-reduced-motion",value:reduce?"reduce":"no-preference"}]});
 await send("Page.navigate",{url:"http://127.0.0.1:4173/"});
 await waitUntil("page ready",async()=>evalJS("document.readyState==='complete'&&!!document.querySelector('.v5-city-stage')"));
}
try{
 await waitUntil("loopback startup",async()=>{
  try{const x=await fetch("http://127.0.0.1:4173/",{signal:AbortSignal.timeout(900)});return x.ok}catch{return false}
 },6000);
 await sleep(1100);
 const t=await send("Target.createTarget",{url:"about:blank"},false);
 const a=await send("Target.attachToTarget",{targetId:t.result.targetId,flatten:true},false);
 sessionId=a.result.sessionId;
 await send("Page.enable");await send("Runtime.enable");
 await viewport(1440,900);
 await evalJS('document.querySelector(".v5-city-stage").scrollIntoView({block:"center",behavior:"instant"})');
 const desktop=await waitUntil("desktop real GPU",async()=>evalJS('(()=>{const e=document.querySelector(".v5-city-stage"),p=window.__dessetV6Probe?.();return e.dataset.v6State==="active"&&p?.triangles>0&&p?.frames>2?p:null})()'),15000);
 check("Desktop WebGL2 real draw calls",desktop.webgl&&desktop.triangles>100&&desktop.drawCalls>0,{desktop});
 check("Real Three.js revision",desktop.threeRevision==="187",{revision:desktop.threeRevision});
 check("Exactly one GPU canvas",desktop.domCanvas===1,{count:desktop.domCanvas});
 await screenshot("desktop-three-webgl.png");
 await evalJS('document.querySelector("[data-v6-camera=commerce]").click()');
 const commerce=await waitUntil("desktop commerce camera",async()=>evalJS('window.__dessetV6Probe?.().currentView==="commerce"'));
 check("Camera views are interactive",Boolean(commerce));
 await evalJS('document.querySelector("[data-v6-camera=destination]").click()');
 const destination=await waitUntil("desktop destination camera",async()=>evalJS('window.__dessetV6Probe?.().currentView==="destination"'));
 check("Camera destination works",Boolean(destination));

 await viewport(390,844);
 const initialMobile=await evalJS('(()=>({script:!![...document.scripts].find(s=>s.src.includes("v6-three.bundle")),button:document.querySelector(".v6-enable-webgl")?.hidden,state:document.querySelector(".v5-city-stage").dataset.v6State}))()');
 check("Mobile 3D is opt-in and not preloaded",!initialMobile.script&&initialMobile.button===false,{initialMobile});
 await evalJS('document.querySelector(".v6-enable-webgl").click()');
 await evalJS('document.querySelector(".v5-city-stage").scrollIntoView({block:"center",behavior:"instant"})');
 const mobile=await waitUntil("mobile real GPU after consent",async()=>evalJS('(()=>{const e=document.querySelector(".v5-city-stage"),p=window.__dessetV6Probe?.();return e.dataset.v6State==="active"&&p?.triangles>0&&p?.frames>2?p:null})()'),15000);
 check("Mobile WebGL2 after explicit opt-in",mobile.webgl&&mobile.triangles>100,{mobile});
 await screenshot("mobile-three-webgl-optin.png");

 await viewport(390,844,true);
 const reduced=await evalJS('(()=>({script:!![...document.scripts].find(s=>s.src.includes("v6-three.bundle")),button:document.querySelector(".v6-enable-webgl")?.hidden,poster:!!document.querySelector(".v5-stage-render")}))()');
 check("Reduced-motion remains static and never loads WebGL",!reduced.script&&reduced.button===true&&reduced.poster,{reduced});
 await screenshot("mobile-reduced-poster.png");
}catch(e){failures.push(String(e.stack||e))}
finally{
 server.kill("SIGTERM");
 chrome.stdio[3]?.end();chrome.kill("SIGTERM");
 await sleep(150);await rm(profile,{recursive:true,force:true}).catch(()=>{});
}
const result={type:"experimental-WebGL2-real-GPU-smoke",checks,failures,captures,
 chromeFlags:"SwiftShader ANGLE software WebGL2 (CI only; NOT physical GPU)",
 limitations:["Not a real low-end mobile device","Chrome software rendering does not certify physical GPU or power usage"],
 serverLog:serverLogs.slice(-300),chromeLog:chromeError.slice(-600)};
await writeFile(join(out,"gpu-audit.json"),JSON.stringify(result,null,2)+"\n");
if(failures.length){console.error("V6 REAL WebGL AUDIT FAIL\n"+failures.join("\n"));process.exitCode=1}
else console.log("V6 REAL WebGL AUDIT PASS "+checks.length+" checks / "+captures.length+" screenshots, triangles="+checks[0].desktop.triangles);
