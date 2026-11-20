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
  const clip=el.closest(".v4-motion-canvas,.v4-hero-rail,.v5-city-stage");
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
  heroLead:parseFloat(getComputedStyle(document.querySelector(".hero-lead")).fontSize),
  sectionTitle:parseFloat(getComputedStyle(document.querySelector(".section-head h2")).fontSize),
  storyTitle:parseFloat(getComputedStyle(document.querySelector(".motion-story-unit h3")).fontSize)
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
  if(diag.typeSizes.heroLead<14||diag.typeSizes.sectionTitle<28||diag.typeSizes.storyTitle<26)fails.push("mobile content typography below release thresholds: "+JSON.stringify(diag.typeSizes));
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
 const kineticIntro=await js('(()=>({version:document.documentElement.dataset.kineticVersion,headlinePx:parseFloat(getComputedStyle(document.querySelector(".motion-headline")).fontSize),blue:getComputedStyle(document.querySelector(".v4-shape-blue")).animationName,mark:getComputedStyle(document.querySelector(".v4-canvas-stamp")).animationName,leadVisible:getComputedStyle(document.querySelector(".hero-lead")).visibility,graphic:document.querySelector(".v4-canvas-stamp img")?.getAttribute("src")}))()');
 if(kineticIntro.version!=="v45"||kineticIntro.headlinePx<110||kineticIntro.blue!=="v45-blue-strike"||kineticIntro.mark!=="v45-mark-lock"||kineticIntro.leadVisible!=="visible"||!kineticIntro.graphic?.includes("deliver-assets-mark.png"))report.failures.push("V4.5 hero kinetic introduction failed: "+JSON.stringify(kineticIntro));
 report.tests.push({name:"V4.5 hero scale and original mark motion",kineticIntro});
 const smallUI=await js('(()=>{const selector=".header-descriptor,.v4-hero-caption,.hero-kicker,.v4-canvas-top,.v4-canvas-bottom,.hero-meta,.section-label,.kicker,.service-top,.ecosystem-board-top,.motion-story-index,.motion-story-status,.audience-no,.audience-tag,.business-pitch-top,.closing-kicker-signal";return {decorativeLabelCount:document.querySelectorAll(selector).length,numberedTokens:document.body.textContent.match(/\\b0[1-9]\\s*\\/\\s*/g)||[],statusVisible:document.querySelector(".trust-ledger-item strong")?.textContent?.trim()}})()');
 if(smallUI.decorativeLabelCount!==0||smallUI.numberedTokens.length!==0||!smallUI.statusVisible)report.failures.push("Editorial numeric labels survived cleanup: "+JSON.stringify(smallUI));
 report.tests.push({name:"Zero editorial numeric labels and redundant tiny captions",smallUI});
 await capture("desktop-entry.png");
 await sleep(1100);
 await capture("desktop-transition.png");
 await sleep(2050);
 await capture("desktop-final.png");
 await capture("desktop-full.png",true);
 const v5Cover=await js('(()=>({mode:document.documentElement.dataset.v5Mode,overlay:!!document.querySelector(".v5-hero-refraction"),stage:!!document.querySelector(".v5-city-stage"),asset:document.querySelector(".v5-stage-render")?.getAttribute("src"),contactLight:!!document.querySelector(".v5-contact-light")}))()');
 if(v5Cover.mode!=="ready"||!v5Cover.overlay||!v5Cover.stage||!v5Cover.asset?.endsWith("v5-logistics-scene.svg")||!v5Cover.contactLight)report.failures.push("V5 cinematic entry incomplete: "+JSON.stringify(v5Cover));
 report.tests.push({name:"V5 cinematic identity and local asset",v5Cover});
 await js('document.querySelector(".v5-city-stage").scrollIntoView({block:"center",behavior:"instant"})');
 await sleep(580);
 const v5Stage=await js('(()=>{const e=document.querySelector(".v5-city-stage"),im=e.querySelector("img"),r=e.getBoundingClientRect(),route=e.querySelector(".v5-route-line");return {visible:e.classList.contains("v5-visible"),imageLoaded:im.complete,width:im.naturalWidth,height:im.naturalHeight,routeAnimation:getComputedStyle(route).animationName,left:r.left,right:r.right,viewport:document.documentElement.clientWidth,caption:e.querySelector("figcaption")?.textContent?.trim()}})()');
 if(!v5Stage.visible||!v5Stage.imageLoaded||v5Stage.width!==1200||v5Stage.height!==560||v5Stage.routeAnimation!=="v5-route-draw"||v5Stage.left< -2||v5Stage.right>v5Stage.viewport+2||!v5Stage.caption?.includes("conceptual")) report.failures.push("V5 rendered route or truthfulness failed: "+JSON.stringify(v5Stage));
 report.tests.push({name:"V5 original rendered 2.5D sequence",v5Stage});
 await capture("desktop-v5-scene-motion.png");
 await sleep(1750);
 await capture("desktop-v5-scene-final.png");
 await js('document.querySelector(".motion-story").scrollIntoView({block:"center",behavior:"instant"})');
 await sleep(450);
 const storyState=await js('({sequence:document.querySelector(".motion-story").classList.contains("motion-active"),cards:[...document.querySelectorAll(".motion-story-unit")].map(x=>({text:x.querySelector("h3")?.textContent,active:x.classList.contains("motion-active")}))})');
 if(!storyState.sequence||storyState.cards.length!==3||storyState.cards.some(x=>!x.active))report.failures.push("Narrative motion sequence not activated: "+JSON.stringify(storyState));
 report.tests.push({name:"Scroll-bound narrative sequence",storyState});
 const scenes=await js('(()=>[...document.querySelectorAll(".motion-story-art img")].map(el=>({src:el.getAttribute("src"),complete:el.complete,width:el.naturalWidth,height:el.naturalHeight,rendered:el.getBoundingClientRect().width})))()');
 if(scenes.length!==3||scenes.some(x=>!x.complete||x.width<100||x.height<100||x.rendered<45))report.failures.push("Commercial narrative illustrations missing or too small: "+JSON.stringify(scenes));
 report.tests.push({name:"Original semantic illustration assets render",scenes});
 await capture("desktop-story-motion.png");
 const kineticJourney=await js('(()=>{const cards=[...document.querySelectorAll(".motion-story-unit")].map(c=>({active:c.classList.contains("motion-active"),animation:getComputedStyle(c.querySelector("img")).animationName}));const route=getComputedStyle(document.querySelector(".motion-story-bridge-line")).animationName;return {cards,route}})()');
 if(kineticJourney.cards.length!==3||kineticJourney.cards.some(x=>!x.active||x.animation!=="v45-scene-illustration")||kineticJourney.route!=="prime-bridge-draw")report.failures.push("Three-beat narrative sequence failed: "+JSON.stringify(kineticJourney));
 report.tests.push({name:"V4.5 staggered real-scene illustration motion",kineticJourney});
 await sleep(1250);
 await capture("desktop-story-final.png");
 await js('document.querySelector("#contacto").scrollIntoView({block:"center",behavior:"instant"})');
 await sleep(450);
 const closing=await js('[...document.querySelectorAll(".closing-line")].map(x=>({word:x.textContent.trim(),active:x.classList.contains("motion-active")}))');
 if(closing.length!==3||closing.some(x=>!x.active))report.failures.push("Closing editorial sequence not activated: "+JSON.stringify(closing));
 report.tests.push({name:"Brand closing motion",closing});
 await capture("desktop-closing-motion.png");
 const kineticFinale=await js('(()=>{const contact=document.querySelector("#contacto"),middle=contact.querySelector(".closing-line--middle");return {active:contact.classList.contains("motion-active"),lineAnimation:getComputedStyle(middle).animationName,underlineAnimation:getComputedStyle(middle,"::after").animationName,slashAnimation:getComputedStyle(contact,"::after").animationName}})()');
 if(!kineticFinale.active||kineticFinale.lineAnimation!=="v45-closing-reveal"||kineticFinale.underlineAnimation!=="v45-underline"||kineticFinale.slashAnimation!=="v45-contact-slash")report.failures.push("Kinetic final contact scene failed: "+JSON.stringify(kineticFinale));
 report.tests.push({name:"V4.5 closing scene and finite underline",kineticFinale});
 const v5Finale=await js('(()=>{const e=document.querySelector("#contacto"),light=e.querySelector(".v5-contact-light");return {visible:e.classList.contains("v5-visible"),effect:getComputedStyle(light).animationName}})()');
 if(!v5Finale.visible||v5Finale.effect!=="v5-contact-arrive")report.failures.push("V5 cinematic contact light did not reveal: "+JSON.stringify(v5Finale));
 report.tests.push({name:"V5 ambient finale",v5Finale});
 await sleep(1250);
 await capture("desktop-closing-final.png");
 await js('document.querySelector(".business-pitch").scrollIntoView({block:"center",behavior:"instant"})');
 await sleep(350);
 const pitch=await js('(()=>{const section=document.querySelector(".business-pitch");const anchor=section.querySelector("a.business-pitch-cta");return {heading:section.querySelector("h3")?.textContent?.replace(/\\s+/g," ").trim(),href:anchor?.getAttribute("href"),label:anchor?.textContent?.trim(),visible:section.getBoundingClientRect().height>180}})()');
 if(!pitch.visible||pitch.href!=="#contacto"||!pitch.heading.includes("NEGOCIO")||!pitch.label.includes("Conversemos"))report.failures.push("Business CTA not credible or inaccessible: "+JSON.stringify(pitch));
 report.tests.push({name:"Commercial pitch CTA",pitch});
 await capture("desktop-business-pitch.png");
 const rc=await js('(()=>{const h=document.querySelector(".hero-cta");const future=document.querySelector(".future-services");const prim=document.querySelector(".contact-primary");const count=[...document.querySelectorAll("h1")].length;return {primaryHref:h.getAttribute("href"),futureCollapsed:!future.open,futureCards:future.querySelectorAll(".service").length,contactHref:prim.getAttribute("href"),contactText:prim.textContent.trim(),contactTarget:prim.getAttribute("target"),candidateStatus:document.querySelector(".contact-status")?.textContent,headingCount:count,removedResponsibility:!document.querySelector(".responsibility")}})()');
 if(rc.primaryHref!=="#contacto"||!rc.futureCollapsed||rc.futureCards!==2||!rc.contactHref.startsWith("https://www.instagram.com/")||rc.contactTarget!=="_blank"||!rc.candidateStatus.includes("no procesa pedidos ni pagos")||rc.headingCount!==1||!rc.removedResponsibility)report.failures.push("RC funnel and honesty contract failed: "+JSON.stringify(rc));
 report.tests.push({name:"V4.3 commercial focus & primary contact",rc});
 await js('document.querySelector(".future-services summary").click()');
 const expandedFuture=await js('(()=>{const d=document.querySelector(".future-services");return {open:d.open,cards:[...d.querySelectorAll(".service")].map(e=>({height:Math.round(e.getBoundingClientRect().height),description:e.querySelector(".service-body p")?.textContent?.trim()}))}})()');
 if(!expandedFuture.open||expandedFuture.cards.length!==2||expandedFuture.cards.some(x=>x.height<170||!x.description?.startsWith("Horizonte futuro:")))report.failures.push("Future services toggle contract failed: "+JSON.stringify(expandedFuture));
 report.tests.push({name:"Deferred expansion accordion",expandedFuture});
 await js('document.querySelector(".future-services").scrollIntoView({block:"center",behavior:"instant"})');
 await sleep(120);
 await capture("desktop-expansion-optional.png");
 await js('document.querySelector(".trust-ledger").scrollIntoView({block:"center",behavior:"instant"})');
 await sleep(180);
 const trustDesktop=await js('(()=>{const el=document.querySelector(".trust-ledger"),cards=[...el.querySelectorAll(".trust-ledger-item")],grid=el.querySelector(".trust-ledger-grid"),v=document.documentElement.clientWidth;return {cards:cards.map(x=>({title:x.querySelector("strong")?.textContent?.trim(),right:Math.round(x.getBoundingClientRect().right),width:Math.round(x.getBoundingClientRect().width),font:parseFloat(getComputedStyle(x.querySelector("p")).fontSize)})),gridCols:getComputedStyle(grid).gridTemplateColumns.split(" ").length,viewport:v,heading:el.querySelector("h3")?.textContent?.trim()}})()');
 if(trustDesktop.cards.length!==3||trustDesktop.gridCols!==3||trustDesktop.cards.some(x=>x.right>trustDesktop.viewport+2||x.font<14)||!trustDesktop.heading.includes("CLARIDAD"))report.failures.push("Trust content broken on desktop: "+JSON.stringify(trustDesktop));
 report.tests.push({name:"Credibility status ledger desktop",trustDesktop});
 await capture("desktop-trust-status.png");
 assert.equal(d.logo.length>=2,true,"Expected original unchanged DESSET mark in header and visual composition");
 for(const [w,h] of [[1024,768],[768,900],[390,844],[320,700]]){
  await viewport(w,h);
  if(w===390){
   await sleep(3200);
   await capture("mobile-final.png");
   await capture("mobile-full.png",true);
   await js('document.querySelector(".business-pitch").scrollIntoView({block:"start",behavior:"instant"})');
   await sleep(240);
   await capture("mobile-business-pitch.png");
   await js('document.querySelector(".contact-primary").scrollIntoView({block:"center",behavior:"instant"})');
   await sleep(100);
   const mobileContact=await js('(()=>{const a=document.querySelector(".contact-primary"),r=a.getBoundingClientRect(),v=document.documentElement.clientWidth;return {label:a.textContent.trim(),left:r.left,right:r.right,height:r.height,viewport:v}})()');
   if(mobileContact.left < -2||mobileContact.right>mobileContact.viewport+2||mobileContact.height<48)report.failures.push("Primary mobile contact clipped or too small: "+JSON.stringify(mobileContact));
   report.tests.push({name:"Mobile primary contact tap target",mobileContact});
   await capture("mobile-contact-final.png");
   await js('document.querySelector(".trust-ledger").scrollIntoView({block:"center",behavior:"instant"})');
   await sleep(160);
   const trustMobile=await js('(()=>{const el=document.querySelector(".trust-ledger"),cards=[...el.querySelectorAll(".trust-ledger-item")],v=document.documentElement.clientWidth;return {viewport:v,cols:getComputedStyle(el.querySelector(".trust-ledger-grid")).gridTemplateColumns.split(" ").length,cards:cards.map(c=>({right:Math.round(c.getBoundingClientRect().right),left:Math.round(c.getBoundingClientRect().left),height:Math.round(c.getBoundingClientRect().height),font:parseFloat(getComputedStyle(c.querySelector("p")).fontSize)}))}})()');
   if(trustMobile.cards.length!==3||trustMobile.cols!==1||trustMobile.cards.some(c=>c.left < -2||c.right>trustMobile.viewport+2||c.height<70||c.font<14))report.failures.push("Trust content clipped or unreadable on mobile: "+JSON.stringify(trustMobile));
   report.tests.push({name:"Credibility status ledger mobile",trustMobile});
   await capture("mobile-trust-status.png");
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
   await js('document.querySelector(".v5-city-stage").scrollIntoView({block:"center",behavior:"instant"})');
   await sleep(350);
   const v5Mobile=await js('(()=>{const e=document.querySelector(".v5-city-stage"),r=e.getBoundingClientRect(),v=document.documentElement.clientWidth;return {visible:e.classList.contains("v5-visible"),left:r.left,right:r.right,viewport:v,overflow:document.documentElement.scrollWidth>v+2,caption:e.querySelector("figcaption")?.textContent?.trim(),imageLoaded:e.querySelector("img")?.naturalWidth>0,source:e.querySelector("img")?.currentSrc,overlay:getComputedStyle(e.querySelector(".v5-route-overlay")).display,ratio:Math.round(e.querySelector(".v5-stage-world").getBoundingClientRect().height/e.querySelector(".v5-stage-world").getBoundingClientRect().width*100)/100}})()');
   if(!v5Mobile.visible||v5Mobile.left< -2||v5Mobile.right>v5Mobile.viewport+2||v5Mobile.overflow||!v5Mobile.imageLoaded||!v5Mobile.source?.includes("v5-logistics-mobile.svg")||v5Mobile.overlay!=="none"||v5Mobile.ratio<1.3||!v5Mobile.caption?.includes("conceptual"))report.failures.push("V5 mobile 390 scene failed: "+JSON.stringify(v5Mobile));
   report.tests.push({name:"V5 mobile 390 cinematic layout",v5Mobile});
   await capture("mobile-v5-scene.png");
  }
  if(w===320){
   const narrowContact=await js('(()=>{const a=document.querySelector(".contact-primary"),r=a.getBoundingClientRect(),v=document.documentElement.clientWidth;return {left:r.left,right:r.right,height:r.height,viewport:v}})()');
   if(narrowContact.left < -2||narrowContact.right>narrowContact.viewport+2||narrowContact.height<48)report.failures.push("320px contact button fail: "+JSON.stringify(narrowContact));
   await sleep(3200);
   await capture("mobile-320-final.png");
   await capture("mobile-320-full.png",true);
   await js('document.querySelector(".v5-city-stage").scrollIntoView({block:"center",behavior:"instant"})');
   await sleep(250);
   const v5Narrow=await js('(()=>{const e=document.querySelector(".v5-city-stage"),art=e.querySelector("img"),b=e.getBoundingClientRect(),v=document.documentElement.clientWidth;return {src:art.currentSrc,width:art.naturalWidth,height:art.naturalHeight,inside:b.left>=-2&&b.right<=v+2,overlay:getComputedStyle(e.querySelector(".v5-route-overlay")).display}})()');
   if(!v5Narrow.src?.includes("v5-logistics-mobile.svg")||v5Narrow.width!==390||v5Narrow.height!==560||!v5Narrow.inside||v5Narrow.overlay!=="none")report.failures.push("V5 mobile 320 narrative composition failed: "+JSON.stringify(v5Narrow));
   report.tests.push({name:"V5 mobile 320 full narrative",v5Narrow});
   await capture("mobile-320-v5-scene.png");
  }
 }
 const reduced=await viewport(390,844,true);
 const reducedMode=await js("document.documentElement.dataset.motionSystem");
 if(reducedMode!=="reduced")report.failures.push("Motion fallback failed for reduced preference: "+String(reducedMode));
 const reducedAnimations=await js('(()=>({blue:getComputedStyle(document.querySelector(".v4-shape-blue")).animationName,stamp:getComputedStyle(document.querySelector(".v4-canvas-stamp")).animationName,headline:document.querySelector(".motion-headline").textContent.trim(),cta:document.querySelector(".hero-cta").getAttribute("href"),closing:document.querySelector("#contact-title").textContent.trim()}))()');
 if(reducedAnimations.blue!=="none"||reducedAnimations.stamp!=="none"||!reducedAnimations.headline.includes("EL COMERCIO")||reducedAnimations.cta!=="#contacto"||!reducedAnimations.closing.includes("CONEXIONES"))report.failures.push("V4.5 reduced motion/essential information failed: "+JSON.stringify(reducedAnimations));
 report.tests.push({name:"V4.5 full-fidelity reduced motion fallback",reducedAnimations});
 const v5Reduced=await js('(()=>({mode:document.documentElement.dataset.v5Mode,route:getComputedStyle(document.querySelector(".v5-route-line")).animationName,light:getComputedStyle(document.querySelector(".v5-contact-light")).animationName,asset:document.querySelector(".v5-stage-render")?.getAttribute("src"),caption:document.querySelector(".v5-stage-caption")?.textContent?.trim()}))()');
 if(v5Reduced.mode!=="reduced"||v5Reduced.route!=="none"||v5Reduced.light!=="none"||!v5Reduced.asset?.includes("v5-logistics-scene.svg")||!v5Reduced.caption?.includes("conceptual"))report.failures.push("V5 reduced-motion content/visibility failed: "+JSON.stringify(v5Reduced));
 report.tests.push({name:"V5 full reduced-motion fallback",v5Reduced});
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
