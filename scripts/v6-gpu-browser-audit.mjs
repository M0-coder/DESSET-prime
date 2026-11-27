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
 await send("Page.navigate",{url:"http://127.0.0.1:4173/prime.html"});
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
 const desktopInitial=await evalJS('(()=>({script:!![...document.scripts].find(s=>s.src.includes("v6-three.bundle")),fallback:!!document.querySelector(".v6-static-fallback"),trigger:document.querySelector(".v6-enable-webgl")?.hidden}))()');
 check("Desktop provides accessible image-free fallback before GPU initialization",desktopInitial.fallback,{desktopInitial});
  const autoDesktop=await waitUntil("desktop automatic WebGL request",async()=>evalJS('!![...document.scripts].find(s=>s.src.includes("v6-three.bundle"))'),8000);
  check("Desktop loads WebGL without a user click",autoDesktop);
 const desktopEarly=await evalJS('(()=>{const e=document.querySelector(".v5-city-stage"),p=window.__dessetV6Probe?.(),fallback=e.querySelector(".v6-static-fallback");return {state:e.dataset.v6State,glbLoaded:p?.glbLoaded||0,fallbackVisible:getComputedStyle(fallback).visibility!=="hidden"}})()');
 check("No premature WebGL reveal before all three GLBs load",
   desktopEarly.state!=="active"?desktopEarly.fallbackVisible:desktopEarly.glbLoaded===3,
   {desktopEarly});
 const desktop=await waitUntil("desktop real GPU",async()=>evalJS('(()=>{const e=document.querySelector(".v5-city-stage"),p=window.__dessetV6Probe?.();return e.dataset.v6State==="active"&&p?.triangles>0&&p?.frames>2?p:null})()'),15000);
 check("Desktop WebGL2 real draw calls",desktop.webgl&&desktop.triangles>100&&desktop.drawCalls>0,{desktop});
 check("Real Three.js revision",desktop.threeRevision==="187",{revision:desktop.threeRevision});
 check("Exactly one GPU canvas",desktop.domCanvas===1,{count:desktop.domCanvas});
 const detailedDesktop=await waitUntil("three real glTF binary models loaded in desktop",async()=>evalJS('(()=>{const p=window.__dessetV6Probe?.();return p?.glbLoaded===3?p:null})()'),17000);
 check("V6.2 desktop three independently loaded GLB models",detailedDesktop.glbLoaded===3&&detailedDesktop.glbModels.every(x=>x.meshes>=5&&x.triangles>=250),{models:detailedDesktop.glbModels,status:detailedDesktop.glbStatus});
 check("PRIME-3D-03 real premium infrastructure and four conceptual dock beacons",detailedDesktop.premiumInfrastructure===true&&detailedDesktop.dockBeacons===4,{premium:detailedDesktop.premiumInfrastructure,beacons:detailedDesktop.dockBeacons});
 const dockFleet=detailedDesktop.operationalFleet||[];
 const physicallyAligned=dockFleet.length===4&&dockFleet.filter(t=>t.dockX!==null).length===4&&
  dockFleet.filter(t=>t.dockX!==null).every(t=>Math.abs(t.x-t.dockX)<.001)&&
  dockFleet.some(t=>t.id==="loading"&&Math.abs(t.z-t.dockZ)<.001);
 check("PRIME-3D-04 four independent dock tractors aligned to four gates and original fifth yard unit",
  physicallyAligned&&detailedDesktop.independentFleetDrawBatches===9&&detailedDesktop.archivedFleetHidden,
  {fleet:dockFleet,drawBatches:detailedDesktop.independentFleetDrawBatches,archivedFleetHidden:detailedDesktop.archivedFleetHidden});
 check("V6.1 real GPU shadows and painted sign textures",desktop.shadows===true&&desktop.textureCount>=2&&desktop.cinematic==="v6.2",{shadows:desktop.shadows,textures:desktop.textureCount,cinematic:desktop.cinematic});
 check("V6.1 desktop geometry and draw call budgets",desktop.geometryCount>35&&desktop.geometryCount<180&&desktop.drawCalls<160,{geometryCount:desktop.geometryCount,drawCalls:desktop.drawCalls});
 const demoHUD=await evalJS('(()=>{const h=document.querySelector(".logistics-hud");const c=h?.querySelectorAll(".logistics-hud__card");const style=h?getComputedStyle(h):null;return {opacity:Number(style?.opacity),visible:style?.visibility,panels:c?.length||0,marked:h?.textContent.includes("DEMO")&&h?.textContent.includes("SIMULACIÓN")}})()');
 check("LOGISTICS V2 desktop dashboard panels are fully visible and explicitly simulated",demoHUD.opacity===1&&demoHUD.visible==="visible"&&demoHUD.panels===2&&demoHUD.marked,{demoHUD});
 await screenshot("desktop-three-webgl.png");
 check("Removed hidden manual camera buttons",!(await evalJS('!!document.querySelector("[data-v6-camera], .v6-poster")')));

 // V6.3: validate the real browser interaction, not only the storyboard source.
 await evalJS('document.querySelector(".v63-tour").click()');
 const storyStarted=await waitUntil("desktop cinematic story begins",async()=>evalJS('(()=>{const p=window.__dessetV6Probe?.();return p?.tourActive&&p.tourProgress>=0?p:null})()'),6000);
 check("V6.3 desktop tour starts with accessible progress",storyStarted.tourActive&&
   (await evalJS('document.querySelector(".v63-story").hidden'))===false&&
   (await evalJS('document.querySelector(".v63-tour").getAttribute("aria-pressed")'))==="true");
 const commerceBeat=await waitUntil("tour reaches commerce",async()=>evalJS('(()=>{const p=window.__dessetV6Probe?.();return p?.tourBeat==="commerce"&&p.currentView==="commerce"?p:null})()'),7000);
 check("V6.3 tour actually moves the camera into commerce",commerceBeat.tourProgress>0&&commerceBeat.tourActive,{beat:commerceBeat.tourBeat,progress:commerceBeat.tourProgress});
 await screenshot("desktop-v63-guided-tour.png");
 await evalJS('document.querySelector(".v6-pause").click()');
 const frozen=await evalJS('window.__dessetV6Probe?.().tourSeconds');
 await sleep(350);
 const frozenAfter=await evalJS('window.__dessetV6Probe?.().tourSeconds');
 check("V6.3 pause freezes cinematic time",Math.abs(frozenAfter-frozen)<0.015,{before:frozen,after:frozenAfter});
 await evalJS('document.querySelector(".v6-pause").click()');
 const resumed=await waitUntil("tour resumes",async()=>evalJS('(()=>{const p=window.__dessetV6Probe?.();return p?.tourSeconds>'+String(frozen+.07)+'?p:null})()'),5000);
 check("V6.3 tour resumes without restarting from zero",resumed.tourSeconds>frozen,{resumed:resumed.tourSeconds});
 await evalJS('document.querySelector(".v63-tour").click()');
 const stoppedTour=await evalJS('(()=>({p:window.__dessetV6Probe?.(),hidden:document.querySelector(".v63-story").hidden,pressed:document.querySelector(".v63-tour").getAttribute("aria-pressed")}))()');
 check("V6.3 tour button cancels autoplay and restores overview",stoppedTour.p.currentView==="overview"&&!stoppedTour.p.tourActive&&stoppedTour.hidden&&stoppedTour.pressed==="false",{camera:stoppedTour.p.currentView});
 
 await viewport(390,844);
 const initialMobile=await evalJS('(()=>({script:!![...document.scripts].find(s=>s.src.includes("v6-three.bundle")),button:document.querySelector(".v6-enable-webgl")?.hidden,state:document.querySelector(".v5-city-stage").dataset.v6State}))()');
 check("Mobile does not preload off-screen 3D",!initialMobile.script,{initialMobile});
  await evalJS('document.querySelector(".v5-city-stage").scrollIntoView({block:"center",behavior:"instant"})');
  const autoMobile=await waitUntil("mobile automatic WebGL request",async()=>evalJS('!![...document.scripts].find(s=>s.src.includes("v6-three.bundle"))'),8000);
  check("Mobile loads WebGL automatically when compatible",autoMobile);
 const mobile=await waitUntil("mobile real GPU after consent",async()=>evalJS('(()=>{const e=document.querySelector(".v5-city-stage"),p=window.__dessetV6Probe?.();return e.dataset.v6State==="active"&&p?.triangles>0&&p?.frames>2?p:null})()'),15000);
 check("Mobile WebGL2 after explicit opt-in",mobile.webgl&&mobile.triangles>100,{mobile});
 const detailedMobile=await waitUntil("three GLB models after mobile user consent",async()=>evalJS('(()=>{const p=window.__dessetV6Probe?.();return p?.glbLoaded===3?p:null})()'),17000);
 check("V6.2 mobile loads all 3 detailed GLB originals after explicit consent",detailedMobile.glbLoaded===3&&detailedMobile.glbModels.length===3,{models:detailedMobile.glbModels});
 check("PRIME-3D-03 premium hub survives mobile GLB hydration",detailedMobile.premiumInfrastructure===true&&detailedMobile.dockBeacons===4,{premium:detailedMobile.premiumInfrastructure,beacons:detailedMobile.dockBeacons});
 const mobileFleet=detailedMobile.operationalFleet||[];
 check("PRIME-3D-04 mobile fleet retains aligned truck gates",
  mobileFleet.length===4&&mobileFleet.filter(t=>t.dockX!==null).length===4&&
  mobileFleet.filter(t=>t.dockX!==null).every(t=>Math.abs(t.x-t.dockX)<.001)&&
  detailedMobile.archivedFleetHidden===true,
  {fleet:mobileFleet,archivedFleetHidden:detailedMobile.archivedFleetHidden});
 check("Mobile suppresses expensive shadow maps but keeps 3D materials",mobile.shadows===false&&mobile.textureCount>=2,{shadows:mobile.shadows,textures:mobile.textureCount});
 const groups=Object.entries(detailedMobile.objectBounds||{});
 const fullyFramed=groups.length===3&&groups.every(([name,b])=>b.minX>=-1.02&&b.maxX<=1.02&&b.minY>=-1.02&&b.maxY<=1.02);
 check("Mobile 3D stations remain within camera frame",fullyFramed,{objectBounds:detailedMobile.objectBounds});
 const mobileHUD=await evalJS('(()=>{const h=document.querySelector(".logistics-hud"),n=h?.querySelector(".logistics-hud__card--notice"),d=h?.querySelector(".logistics-hud__card--docks"),badge=h?.querySelector(".logistics-hud__demo");const hs=h?getComputedStyle(h):null;return {opacity:Number(hs?.opacity),visible:hs?.visibility,noticeHidden:getComputedStyle(n).display==="none",docksHidden:getComputedStyle(d).display==="none",demoBadgeVisible:getComputedStyle(badge).display!=="none"&&badge.textContent==="DEMO",declaresSimulation:n?.textContent.includes("SIMULADA")}})()');
 check("PRIME-3D-04 mobile retains DEMO disclosure without obstructing 3D with large cards",mobileHUD.opacity===1&&mobileHUD.visible==="visible"&&mobileHUD.noticeHidden&&mobileHUD.docksHidden&&mobileHUD.demoBadgeVisible&&mobileHUD.declaresSimulation,{mobileHUD});
 await screenshot("mobile-three-webgl-optin.png");

 await evalJS('document.querySelector(".v63-tour").click()');
 const tourMobile=await waitUntil("mobile guided tour begins",async()=>evalJS('(()=>{const p=window.__dessetV6Probe?.();return p?.tourActive&&p.tourProgress>0?p:null})()'),6000);
 check("V6.3 mobile starts story on demand",tourMobile.tourActive&&tourMobile.tourProgress>0,{beat:tourMobile.tourBeat,progress:tourMobile.tourProgress});
 await screenshot("mobile-v63-guided-tour.png");
 await evalJS('document.querySelector(".v63-tour").click()');
 const canceledMobile=await evalJS('window.__dessetV6Probe?.().tourActive');
 check("V6.3 mobile user may stop the tour immediately",canceledMobile===false);

 await evalJS('document.querySelector(".v6-pause").click()');
 const pausedBefore=await evalJS('window.__dessetV6Probe?.().frames');
 await sleep(340);
 const pausedAfter=await evalJS('window.__dessetV6Probe?.().frames');
 check("Pause stops the WebGL animation loop",pausedAfter===pausedBefore,{pausedBefore,pausedAfter});
 await evalJS('document.querySelector(".v6-pause").click()');
 await waitUntil("WebGL resumes",async()=>evalJS('window.__dessetV6Probe?.().frames > '+pausedAfter),5000);
 check("Resume restarts WebGL frame delivery",true);
 check("WebGL retains one canvas after pause/resume",(await evalJS('document.querySelectorAll(".v6-three-mount canvas").length'))===1);

 // The duplicate hero 3D CTA was deleted; the real section auto-starts
 // WebGL2 on viewport entry and keeps an explicit guided-tour control.
 await viewport(390,844);
 const beforeScene=await evalJS('(()=>({loading:!![...document.scripts].find(s=>s.src.includes("v6-three.bundle")),removedCTA:!document.querySelector("[data-v64-tour-launch]"),stage:!!document.querySelector(".v5-city-stage")}))()');
 check("Mobile hero has no duplicate 3D CTA or offscreen GPU preload",beforeScene.removedCTA&&!beforeScene.loading&&beforeScene.stage,{beforeScene});
 await evalJS('document.querySelector(".v5-city-stage").scrollIntoView({block:"center",behavior:"instant"})');
 const readyScene=await waitUntil("scrolled mobile section loads three real GLBs",async()=>evalJS('(()=>{const p=window.__dessetV6Probe?.();return p?.glbLoaded===3&&p?.domCanvas===1?p:null})()'),18000);
 check("Mobile 3D auto-start survives editorial removal",readyScene.glbLoaded===3&&readyScene.domCanvas===1,{models:readyScene.glbLoaded});
 await evalJS('document.querySelector(".v63-tour").click()');
 const guidedScene=await waitUntil("3D guided tour starts from real section button",async()=>evalJS('(()=>{const p=window.__dessetV6Probe?.();return p?.tourActive?p:null})()'),6000);
 check("One section control starts guided GLB tour",guidedScene.tourActive,{models:guidedScene.glbLoaded,beat:guidedScene.tourBeat});
 await screenshot("mobile-v64-section-3d-site-integration.png");

 // Tablet breakpoint audit: 431–800px uses a landscape WebGL layout,
 // with cheaper shaders but the same three original GLBs in frame.
 await viewport(768,1024);
 await evalJS('document.querySelector(".v5-city-stage").scrollIntoView({block:"center",behavior:"instant"})');
 const tabletFallback=await evalJS('(()=>({stage:document.querySelector(".v5-city-stage"),staticText:!!document.querySelector(".v6-static-fallback"),script:!![...document.scripts].find(s=>s.src.includes("v6-three.bundle"))}))()');
 check("Tablet keeps accessible text while GPU loads",!!tabletFallback.stage&&tabletFallback.staticText,{tabletFallback});
  const autoTablet=await waitUntil("tablet automatic WebGL request",async()=>evalJS('!![...document.scripts].find(s=>s.src.includes("v6-three.bundle"))'),8000);
  check("Tablet scene loads automatically",autoTablet);
 const tablet=await waitUntil("three GLB models render in 768px layout",async()=>evalJS('(()=>{const p=window.__dessetV6Probe?.();return p?.glbLoaded===3&&p.frames>2?p:null})()'),17000);
 const tabletBounds=Object.values(tablet.objectBounds||{});
 const tabletFramed=tabletBounds.length===3&&tabletBounds.every(b=>b.minX>=-1.04&&b.maxX<=1.04&&b.minY>=-1.04&&b.maxY<=1.04);
 check("Tablet camera fits all three GLB models within the landscape frame",tabletFramed,{bounds:tablet.objectBounds});
 await screenshot("tablet-768-three-webgl.png");
 await send("Emulation.setDeviceMetricsOverride",{width:1024,height:800,deviceScaleFactor:1,mobile:false});
 await waitUntil("responsive breakpoint restores text fallback",async()=>evalJS('document.querySelector(".v5-city-stage")?.dataset.v6State==="fallback"'),4000);
 const rotated=await evalJS('(()=>{const stage=document.querySelector(".v5-city-stage");return {canvas:stage.querySelectorAll(".v6-three-mount canvas").length,trigger:stage.querySelector(".v6-enable-webgl").hidden}})()');
 check("Resize across quality breakpoint frees GPU and offers safe reopen",rotated.canvas===0&&rotated.trigger===false,{rotated});

 await viewport(390,844,true);
 const reduced=await evalJS('(()=>({script:!![...document.scripts].find(s=>s.src.includes("v6-three.bundle")),button:document.querySelector(".v6-enable-webgl")?.hidden,staticText:!!document.querySelector(".v6-static-fallback"),image:!!document.querySelector(".v5-responsive-art")}))()');
 check("Reduced-motion uses accessible text, never deleted image",!reduced.script&&reduced.button===true&&reduced.staticText&&!reduced.image,{reduced});
 await screenshot("mobile-reduced-static.png");
 const reducedStatus=await evalJS('(()=>{const s=document.querySelector(".v65-load-status");return {visible:!s.hidden&&getComputedStyle(s).display!=="none",text:s.textContent}})()');
 check("Reduced-motion fallback explains why 3D is inactive",reducedStatus.visible&&reducedStatus.text.includes("Movimiento reducido"),{reducedStatus});
 const noGPU=await send("Page.addScriptToEvaluateOnNewDocument",{source:`(()=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return type==="webgl2"?null:original.call(this,type,...args)}})()`});
 await viewport(1440,900);
 await evalJS('document.querySelector(".v5-city-stage").scrollIntoView({block:"center",behavior:"instant"})');
 const unsupported=await waitUntil("unsupported WebGL shows retry and explanation",async()=>evalJS('(()=>{const e=document.querySelector(".v5-city-stage"),b=e.querySelector(".v6-enable-webgl"),s=e.querySelector(".v65-load-status");return e.dataset.v6State==="unsupported"?{visible:!b.hidden&&getComputedStyle(b).display!=="none"&&b.getBoundingClientRect().width>0,status:!s.hidden&&getComputedStyle(s).display!=="none"&&s.textContent.includes("WebGL2"),noBundle:![...document.scripts].some(x=>x.src.includes("v6-three.bundle")),fallback:getComputedStyle(e.querySelector(".v6-static-fallback")).visibility==="visible"}:null})()'),8000);
 check("Unsupported WebGL leaves visible retry, explanation and fallback",unsupported.visible&&unsupported.status&&unsupported.noBundle&&unsupported.fallback,{unsupported});
 await evalJS('document.querySelector(".v6-enable-webgl").click()');
 const retry=await evalJS('(()=>{const b=document.querySelector(".v6-enable-webgl"),s=document.querySelector(".v65-load-status");return {visible:!b.hidden&&getComputedStyle(b).display!=="none",status:!s.hidden,noBundle:![...document.scripts].some(x=>x.src.includes("v6-three.bundle"))}})()');
 check("Retry on unsupported browser never hides the button or silently loads GPU",retry.visible&&retry.status&&retry.noBundle,{retry});
 await screenshot("desktop-webgl-unavailable-retry.png");
 await send("Page.removeScriptToEvaluateOnNewDocument",{identifier:noGPU.result.identifier});
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
else {const gpuCheck=checks.find(x=>x.name==="Desktop WebGL2 real draw calls");console.log("V6 REAL WebGL AUDIT PASS "+checks.length+" checks / "+captures.length+" screenshots, triangles="+(gpuCheck?.desktop?.triangles??"not recorded"));}
