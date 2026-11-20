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
 const desktopInitial=await evalJS('(()=>({script:!![...document.scripts].find(s=>s.src.includes("v6-three.bundle")),poster:document.querySelector(".v5-stage-render")?.complete,trigger:document.querySelector(".v6-enable-webgl")?.hidden}))()');
 check("Desktop keeps cinematic render until explicit Three.js opt-in",!desktopInitial.script&&desktopInitial.trigger===false&&desktopInitial.poster,{desktopInitial});
 await evalJS('document.querySelector(".v6-enable-webgl").click()');
 const desktopEarly=await evalJS('(()=>{const e=document.querySelector(".v5-city-stage"),p=window.__dessetV6Probe?.();return {state:e.dataset.v6State,glbLoaded:p?.glbLoaded||0,posterOpacity:getComputedStyle(e.querySelector(".v5-responsive-art")).opacity}})()');
 check("No premature WebGL reveal before all three GLBs load",
   desktopEarly.state!=="active"?(desktopEarly.posterOpacity!=="0"):desktopEarly.glbLoaded===3,
   {desktopEarly});
 const desktop=await waitUntil("desktop real GPU",async()=>evalJS('(()=>{const e=document.querySelector(".v5-city-stage"),p=window.__dessetV6Probe?.();return e.dataset.v6State==="active"&&p?.triangles>0&&p?.frames>2?p:null})()'),15000);
 check("Desktop WebGL2 real draw calls",desktop.webgl&&desktop.triangles>100&&desktop.drawCalls>0,{desktop});
 check("Real Three.js revision",desktop.threeRevision==="187",{revision:desktop.threeRevision});
 check("Exactly one GPU canvas",desktop.domCanvas===1,{count:desktop.domCanvas});
 const detailedDesktop=await waitUntil("three real glTF binary models loaded in desktop",async()=>evalJS('(()=>{const p=window.__dessetV6Probe?.();return p?.glbLoaded===3?p:null})()'),17000);
 check("V6.2 desktop three independently loaded GLB models",detailedDesktop.glbLoaded===3&&detailedDesktop.glbModels.every(x=>x.meshes>=5&&x.triangles>=250),{models:detailedDesktop.glbModels,status:detailedDesktop.glbStatus});
 check("V6.1 real GPU shadows and painted sign textures",desktop.shadows===true&&desktop.textureCount>=2&&desktop.cinematic==="v6.2",{shadows:desktop.shadows,textures:desktop.textureCount,cinematic:desktop.cinematic});
 check("V6.1 desktop geometry and draw call budgets",desktop.geometryCount>35&&desktop.geometryCount<180&&desktop.drawCalls<160,{geometryCount:desktop.geometryCount,drawCalls:desktop.drawCalls});
 check("RENDER-01 desktop local cinematic floor lighting",desktop.render01Pools===3&&desktop.render01Texture===true&&desktop.drawCalls<160,{pools:desktop.render01Pools,localTexture:desktop.render01Texture,drawCalls:desktop.drawCalls});
 await screenshot("desktop-three-webgl.png");
 await evalJS('document.querySelector("[data-v6-camera=commerce]").click()');
 const commerce=await waitUntil("desktop commerce camera",async()=>evalJS('window.__dessetV6Probe?.().currentView==="commerce"'));
 check("Camera views are interactive",Boolean(commerce));
 await evalJS('document.querySelector("[data-v6-camera=destination]").click()');
 const destination=await waitUntil("desktop destination camera",async()=>evalJS('window.__dessetV6Probe?.().currentView==="destination"'));
 check("Camera destination works",Boolean(destination));

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
 await evalJS('document.querySelector("[data-v6-camera=courier]").click()');
 const manualCourier=await evalJS('(()=>({p:window.__dessetV6Probe?.(),hidden:document.querySelector(".v63-story").hidden,pressed:document.querySelector(".v63-tour").getAttribute("aria-pressed")}))()');
 check("V6.3 manual rider camera cancels autoplay and hides story",
   manualCourier.p.currentView==="courier"&&!manualCourier.p.tourActive&&manualCourier.hidden&&manualCourier.pressed==="false",
   {camera:manualCourier.p.currentView,active:manualCourier.p.tourActive});
 
 await viewport(390,844);
 const initialMobile=await evalJS('(()=>({script:!![...document.scripts].find(s=>s.src.includes("v6-three.bundle")),button:document.querySelector(".v6-enable-webgl")?.hidden,state:document.querySelector(".v5-city-stage").dataset.v6State}))()');
 check("Mobile 3D is opt-in and not preloaded",!initialMobile.script&&initialMobile.button===false,{initialMobile});
 await evalJS('document.querySelector(".v6-enable-webgl").click()');
 await evalJS('document.querySelector(".v5-city-stage").scrollIntoView({block:"center",behavior:"instant"})');
 const mobile=await waitUntil("mobile real GPU after consent",async()=>evalJS('(()=>{const e=document.querySelector(".v5-city-stage"),p=window.__dessetV6Probe?.();return e.dataset.v6State==="active"&&p?.triangles>0&&p?.frames>2?p:null})()'),15000);
 check("Mobile WebGL2 after explicit opt-in",mobile.webgl&&mobile.triangles>100,{mobile});
 const detailedMobile=await waitUntil("three GLB models after mobile user consent",async()=>evalJS('(()=>{const p=window.__dessetV6Probe?.();return p?.glbLoaded===3?p:null})()'),17000);
 check("V6.2 mobile loads all 3 detailed GLB originals after explicit consent",detailedMobile.glbLoaded===3&&detailedMobile.glbModels.length===3,{models:detailedMobile.glbModels});
 check("Mobile suppresses expensive shadow maps but keeps 3D materials",mobile.shadows===false&&mobile.textureCount>=2,{shadows:mobile.shadows,textures:mobile.textureCount});
 check("RENDER-01 mobile reuses local floor lighting without shadow maps",mobile.render01Pools===3&&mobile.render01Texture===true&&!mobile.shadows,{pools:mobile.render01Pools,localTexture:mobile.render01Texture,shadows:mobile.shadows});
 const groups=Object.entries(detailedMobile.objectBounds||{});
 const fullyFramed=groups.length===3&&groups.every(([name,b])=>b.minX>=-1.02&&b.maxX<=1.02&&b.minY>=-1.02&&b.maxY<=1.02);
 check("Mobile 3D stations remain within camera frame",fullyFramed,{objectBounds:detailedMobile.objectBounds});
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
 await evalJS('document.querySelector(".v6-poster").click()');
 const poster=await evalJS('(()=>{const e=document.querySelector(".v5-city-stage");return {state:e.dataset.v6State,canvases:e.querySelectorAll(".v6-three-mount canvas").length,reopen:!e.querySelector(".v6-enable-webgl").hidden,controls:e.querySelector(".v6-three-controls").hidden}})()');
 check("Poster frees GPU canvas and restores accessible fallback",poster.state==="poster"&&poster.canvases===0&&poster.reopen&&poster.controls,{poster});
 await evalJS('document.querySelector(".v6-enable-webgl").click()');
 const reopened=await waitUntil("WebGL reopened after poster",async()=>evalJS('(()=>{const p=window.__dessetV6Probe?.();return p?.triangles>100&&p?.domCanvas===1?p:null})()'),15000);
 check("WebGL scene reopens cleanly without duplicate canvas",reopened.domCanvas===1&&reopened.triangles>100,{reopened});

 // One-click real website integration: hero CTA is the mobile opt-in
 // and must launch the actual guided GLB tour, not just scroll to artwork.
 await viewport(390,844);
 const beforeHero=await evalJS('(()=>({loading:!![...document.scripts].find(s=>s.src.includes("v6-three.bundle")),cta:!!document.querySelector("[data-v64-tour-launch]")}))()');
 check("Prime mobile hero exposes 3D journey without preloading WebGL",beforeHero.cta&&!beforeHero.loading,{beforeHero});
 await evalJS('document.querySelector("[data-v64-tour-launch]").click()');
 await evalJS('document.querySelector(".v5-city-stage").scrollIntoView({block:"center",behavior:"instant"})');
 const heroTour=await waitUntil("hero launches GLB cinematic experience",async()=>evalJS('(()=>{const p=window.__dessetV6Probe?.();return p?.glbLoaded===3&&p?.tourActive?p:null})()'),18000);
 check("One-click hero activates all GLBs and guided 3D tour",heroTour.glbLoaded===3&&heroTour.tourActive,
  {models:heroTour.glbLoaded,beat:heroTour.tourBeat});
 await screenshot("mobile-v64-hero-3d-site-integration.png");

 // Tablet breakpoint audit: 431–800px uses a landscape WebGL layout,
 // with cheaper shaders but the same three original GLBs in frame.
 await viewport(768,1024);
 await evalJS('document.querySelector(".v5-city-stage").scrollIntoView({block:"center",behavior:"instant"})');
 const tabletPoster=await evalJS('(()=>({stage:document.querySelector(".v5-city-stage"),trigger:document.querySelector(".v6-enable-webgl").hidden,script:!![...document.scripts].find(s=>s.src.includes("v6-three.bundle"))}))()');
 check("Tablet starts with the premium static poster",tabletPoster.trigger===false&&!tabletPoster.script);
 await evalJS('document.querySelector(".v6-enable-webgl").click()');
 const tablet=await waitUntil("three GLB models render in 768px layout",async()=>evalJS('(()=>{const p=window.__dessetV6Probe?.();return p?.glbLoaded===3&&p.frames>2?p:null})()'),17000);
 const tabletBounds=Object.values(tablet.objectBounds||{});
 const tabletFramed=tabletBounds.length===3&&tabletBounds.every(b=>b.minX>=-1.04&&b.maxX<=1.04&&b.minY>=-1.04&&b.maxY<=1.04);
 check("Tablet camera fits all three GLB models within the landscape frame",tabletFramed,{bounds:tablet.objectBounds});
 await screenshot("tablet-768-three-webgl.png");
 await send("Emulation.setDeviceMetricsOverride",{width:1024,height:800,deviceScaleFactor:1,mobile:false});
 await waitUntil("responsive breakpoint restores poster",async()=>evalJS('document.querySelector(".v5-city-stage")?.dataset.v6State==="poster"'),4000);
 const rotated=await evalJS('(()=>{const stage=document.querySelector(".v5-city-stage");return {canvas:stage.querySelectorAll(".v6-three-mount canvas").length,trigger:stage.querySelector(".v6-enable-webgl").hidden}})()');
 check("Resize across quality breakpoint frees GPU and offers safe reopen",rotated.canvas===0&&rotated.trigger===false,{rotated});

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
else {const gpuCheck=checks.find(x=>x.name==="Desktop WebGL2 real draw calls");console.log("V6 REAL WebGL AUDIT PASS "+checks.length+" checks / "+captures.length+" screenshots, triangles="+(gpuCheck?.desktop?.triangles??"not recorded"));}
