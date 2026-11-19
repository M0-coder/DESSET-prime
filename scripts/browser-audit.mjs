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
  // Visual montage intentionally clips decorative children; keep checking parent bounds and headline text.
  const clip=el.closest(".v4-motion-canvas,.v4-hero-rail");
  if(clip&&clip!==el)return false;
  const s=getComputedStyle(el),r=el.getBoundingClientRect();
  return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.left < -2 || (s.display!=='none'&&s.visibility!=='hidden'&&r.right>viewport+2&&r.width>0);
 }).slice(0,12).map(el=>({tag:el.tagName,className:typeof el.className==='string'?el.className.slice(0,70):'',right:Math.round(el.getBoundingClientRect().right),left:Math.round(el.getBoundingClientRect().left)}));
 const rail=document.querySelector(".v4-hero-rail");
 const railBox=rail.getBoundingClientRect();
 const railWords=[...rail.querySelectorAll("span")].map(el=>{
  const r=el.getBoundingClientRect(),style=getComputedStyle(el);
  return {text:el.textContent.trim(),visible:style.display!=="none"&&style.visibility!=="hidden",inside:r.left>=railBox.left-2&&r.right<=railBox.right+2,width:Math.round(r.width)};
 });
 const typeSizes={
  heroKicker:parseFloat(getComputedStyle(document.querySelector(".hero-kicker")).fontSize),
  sectionLabel:parseFloat(getComputedStyle(document.querySelector(".section-label")).fontSize),
  flowNumber:parseFloat(getComputedStyle(document.querySelector(".motion-story-index")).fontSize)
 };
 return {viewport,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,logo,text,offscreen:nodes,railWords,typeSizes,navDisplay:getComputedStyle(document.querySelector('.main-nav')).display,animation:getComputedStyle(document.querySelector('.motion-line__inner')).animationName};
})()`);
 const fails=[];
 if(diag.scrollWidth>width+2)fails.push("horizontal scroll "+diag.scrollWidth+" > "+width);
 if(diag.text.some(t=>t.contentWidth>t.visibleWidth+2))fails.push("clipped hero headline");
 if(diag.logo.some(x=>!x.complete||x.naturalWidth===0))fails.push("broken image");
 if(diag.offscreen.some(x=>!x.className.includes("skip-link") && !x.className.includes("hero-symbol-echoes") && !x.className.includes("hero-stage") && !x.className.includes("art-")))fails.push("element off-screen: "+JSON.stringify(diag.offscreen));
 if(reduce&&diag.animation!=="none")fails.push("reduced motion did not disable animation");
 if(width<=700){
  if(diag.railWords.length!==4||diag.railWords.some(w=>!w.visible||!w.inside||w.width<45))fails.push("mobile editorial keyword rail clips or hides a word: "+JSON.stringify(diag.railWords));
  if(diag.typeSizes.heroKicker<11||diag.typeSizes.sectionLabel<11||diag.typeSizes.flowNumber<11)fails.push("mobile editorial labels smaller than 11px: "+JSON.stringify(diag.typeSizes));
 }
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
 const motionMode=await js("document.documentElement.dataset.motionSystem");
 if(motionMode!=="ready")report.failures.push("Intersection motion system unavailable: "+String(motionMode));
 report.tests.push({name:"Progressive motion system active",mode:motionMode});
 const heroQuality=await js(`(()=>({headline:document.querySelector("#hero-title")?.textContent?.replace(/\\s+/g," ").trim(),art:!!document.querySelector(".v4-motion-canvas"),oldDiagram:!!document.querySelector("#inicio .system-illustration"),brand:document.querySelector(".v4-canvas-stamp img")?.getAttribute("src"),flow:!!document.querySelector(".v4-flow-board"),unapprovedAutoPublish:!!document.querySelector("[data-deploy]")}))()`);
 if(!heroQuality.headline?.includes("EL COMERCIO")||!heroQuality.headline?.includes("SE MUEVE")||!heroQuality.art||heroQuality.oldDiagram||!heroQuality.flow||!heroQuality.brand?.includes("deliver-assets-mark.png")||heroQuality.unapprovedAutoPublish) report.failures.push("V4 visual contract failed: "+JSON.stringify(heroQuality));
 report.tests.push({name:"V4 motion/design contract",heroQuality});
 await capture("desktop-entry.png");
 await sleep(1100);
 await capture("desktop-transition.png");
 await sleep(2050);
 await capture("desktop-final.png");
 await capture("desktop-full.png",true);
 await js('document.querySelector(".motion-story").scrollIntoView({block:"center",behavior:"instant"})');
 await sleep(450);
 const storyState=await js('({sequence:document.querySelector(".motion-story").classList.contains("motion-active"),cards:[...document.querySelectorAll(".motion-story-unit")].map(x=>({text:x.querySelector("h3")?.textContent,active:x.classList.contains("motion-active")}))})');
 if(!storyState.sequence||storyState.cards.length!==3||storyState.cards.some(x=>!x.active))report.failures.push("Narrative motion sequence not activated: "+JSON.stringify(storyState));
 report.tests.push({name:"Scroll-bound narrative sequence",storyState});
 await capture("desktop-story-motion.png");
 await js('document.querySelector("#contacto").scrollIntoView({block:"center",behavior:"instant"})');
 await sleep(450);
 const closing=await js('[...document.querySelectorAll(".closing-line")].map(x=>({word:x.textContent.trim(),active:x.classList.contains("motion-active")}))');
 if(closing.length!==3||closing.some(x=>!x.active))report.failures.push("Closing editorial sequence not activated: "+JSON.stringify(closing));
 report.tests.push({name:"Brand closing motion",closing});
 await capture("desktop-closing-motion.png");
 assert.equal(d.logo.length>=2,true,"Expected original unchanged DESSET mark in header and visual composition");
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
   const details=await js('document.querySelector(".v4-architecture-details")?.open');
   if(details)report.failures.push("Technical roles should be collapsed by default");
   await js('document.querySelector(".v4-architecture-details summary").click()');
   const detailOpen=await js('(()=>{const d=document.querySelector(".v4-architecture-details");const cards=[...d.querySelectorAll(".role")];return {open:d.open,visible:cards.every(c=>c.getBoundingClientRect().height>40),roles:cards.length}})()');
   if(!detailOpen.open||!detailOpen.visible||detailOpen.roles!==4)report.failures.push("Technical roles accordion failed: "+JSON.stringify(detailOpen));
   await js('document.querySelector(".v4-architecture-details").scrollIntoView({block:"start",behavior:"instant"})');
   await sleep(100);
   await capture("mobile-architecture-expanded.png");
   report.tests.push({name:"mobile technical detail expandable",detailOpen});
  }
  if(w===320){
   await sleep(3200);
   await capture("mobile-320-final.png");
   await capture("mobile-320-full.png",true);
  }
 }
 const reduced=await viewport(390,844,true);
 const reducedMode=await js("document.documentElement.dataset.motionSystem");
 if(reducedMode!=="reduced")report.failures.push("Motion fallback failed for reduced preference: "+String(reducedMode));
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
