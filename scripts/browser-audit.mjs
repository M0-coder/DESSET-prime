import {companyRoutes,companyTitles} from "./company-routes.mjs";
import assert from "node:assert/strict";
import {auditPrivateMerchant} from "./merchant-registration-browser-audit.mjs";
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
// BRAND-DUAL-PALETTE-01: sample computed tokens on existing public QA captures.
const brandPlan=JSON.parse(await readFile(resolve("config/brand-dual-palette-plan.json"),"utf8"));
const brandRoutes=new Map(["","dist/"].flatMap(prefix=>brandPlan.page_groups.flatMap(g=>g.pages).map(page=>[pathToFileURL(resolve(prefix+page)).href,prefix+page])));
const brandSamples=new Set();
async function auditBrandTokens(){
 const state=await js(`(()=>({url:location.href,width:innerWidth,tokens:[document.documentElement,document.body].map(e=>getComputedStyle(e).getPropertyValue("--blue").trim().toUpperCase())}))()`);
 const page=brandRoutes.get(state.url);if(!page)return;
 const key=page+":"+state.width;if(brandSamples.has(key))return;brandSamples.add(key);
 if(state.tokens.some(c=>c!==brandPlan.palettes.digital.blue))report.failures.push("BRAND-DUAL-PALETTE-01 computed blue "+key+": "+JSON.stringify(state.tokens));
 report.tests.push({name:"BRAND-DUAL-PALETTE-01 computed blue "+key,pass:state.tokens.every(c=>c===brandPlan.palettes.digital.blue),tokens:state.tokens});
}
async function capture(name,full=false){
 await auditBrandTokens();
 const x=await call("Page.captureScreenshot",{format:"png",captureBeyondViewport:full,fromSurface:true});
 const buf=Buffer.from(x.result.data,"base64");
 assert.ok(buf.length>2000,"Screenshot unexpectedly empty: "+name);
 await writeFile(join(output,name),buf);
 report.screenshots.push({name,size_bytes:buf.length});
}
const URL=pathToFileURL(resolve("index.html")).href;
async function viewport(width,height,reduce=false,entry=URL){
 await call("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:width<=800});
 await call("Emulation.setEmulatedMedia",{media:"screen",features:[{name:"prefers-reduced-motion",value:reduce?"reduce":"no-preference"}]});
 await call("Page.navigate",{url:entry});
 await until(async()=>await js("document.readyState==='complete' && !!document.querySelector('.hero--motion')"),"page render");
 await js('document.fonts.ready');
 // PRIME-COLOR-03 must sample the final opaque CTA, not a partial CSS
 // background transition. Fail closed if it never becomes fully opaque.
 await until(async()=>await js(`(()=>{
   const el=document.querySelector("#inicio .hero-cta");
   if(!el)return false;
   const color=getComputedStyle(el).borderTopColor;
   const match=color.match(/^rgba\\(\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*([\\d.]+)\\s*\\)$/);
   return !match||Number(match[1])>=0.9999;
 })()`),"fully opaque hero CTA border after its CSS transition");
 await sleep(130);
 const diag=await js(`(()=>{
 const viewport=document.documentElement.clientWidth;
 const logo=[...document.images].map(x=>({src:x.getAttribute('src'),loading:x.loading,complete:x.complete,naturalWidth:x.naturalWidth,naturalHeight:x.naturalHeight}));
 const text=[...document.querySelectorAll('.motion-line, .statement h2, .contact h2')].map(el=>{
  const r=document.createRange();r.selectNodeContents(el);
  return {text:el.innerText,contentWidth:Math.round(r.getBoundingClientRect().width),visibleWidth:Math.round(el.getBoundingClientRect().width),clientWidth:el.clientWidth,scrollWidth:el.scrollWidth};
 });
 const nodes=[...document.querySelectorAll('body *')].filter(el=>{
  // Visual montage intentionally clips decorative children; keep checking parent bounds and headline text.
  const clip=el.closest(".v4-motion-canvas,.v4-hero-rail,.v5-city-stage");
  if(clip&&clip!==el)return false;
  // Rail overflow is checked separately with its exact viewport edges and scrollbar tolerance.
  if(el.classList.contains("v4-hero-rail"))return false;
  const s=getComputedStyle(el),r=el.getBoundingClientRect();
  return s.display!=='none'&&s.visibility!=='hidden'&&r.width>0&&r.left < -2 || (s.display!=='none'&&s.visibility!=='hidden'&&r.right>viewport+2&&r.width>0);
 }).slice(0,12).map(el=>({tag:el.tagName,className:typeof el.className==='string'?el.className.slice(0,70):'',right:Math.round(el.getBoundingClientRect().right),left:Math.round(el.getBoundingClientRect().left)}));
 const composition=document.querySelector("#inicio .v4-hero-composition").getBoundingClientRect();
 const type=document.querySelector("#inicio .v4-hero-type").getBoundingClientRect();
 const photo=document.querySelector("#inicio .prime-photo-surface").getBoundingClientRect();
 const messageBox=document.querySelector("#hero-messages").getBoundingClientRect();
 const messageCTA=document.querySelector("#inicio .hero-cta").getBoundingClientRect();
 const messageFit={buttons:document.querySelectorAll("#inicio .desset-editorial-stage button").length,fullWidth:Math.abs(messageBox.width-type.width)<2,aboveCTA:messageBox.bottom<=messageCTA.top-8,inside:messageBox.left>=type.left-2&&messageBox.right<=type.right+2&&messageBox.top>=composition.top&&messageCTA.bottom<=composition.bottom+2,rows:[...document.querySelectorAll("#hero-messages span")].map(e=>{const range=document.createRange();range.selectNodeContents(e);const b=range.getBoundingClientRect();return b.left>=messageBox.left-2&&b.right<=messageBox.right+2&&b.top>=messageBox.top-2&&b.bottom<=messageBox.bottom+2;})};
 const heroFit={
  compositionLeft:Math.round(composition.left),
  typeLeft:Math.round(type.left),typeRight:Math.round(type.right),
  photoLeft:Math.round(photo.left),
  fontSize:parseFloat(getComputedStyle(document.querySelector("#inicio .motion-headline")).fontSize),
  rows:[...document.querySelectorAll("#inicio .motion-line__inner")].map(el=>{
   const range=document.createRange();range.selectNodeContents(el);
   const content=range.getBoundingClientRect(),line=el.closest(".motion-line").getBoundingClientRect();
   return {text:el.textContent.trim(),contentLeft:Math.round(content.left),
    contentRight:Math.round(content.right),lineLeft:Math.round(line.left),
    lineRight:Math.round(line.right)};
  })
 };
 const rail=document.querySelector(".v4-hero-rail");
 const railBox=rail.getBoundingClientRect();
 const railItems=[...rail.querySelectorAll(".v4-rail-item")].map(el=>{
  const r=el.getBoundingClientRect(),title=el.querySelector("strong"),copy=el.querySelector("p"),svg=el.querySelector("svg");
  const style=getComputedStyle(el),copyStyle=copy&&getComputedStyle(copy);
  return {title:title?.textContent.trim(),copy:copy?.textContent.trim(),
   visible:style.display!=="none"&&style.visibility!=="hidden",
   inside:r.left>=railBox.left-2&&r.right<=railBox.right+2,
   textFits:!!title&&!!copy&&title.scrollWidth<=title.clientWidth+2&&(viewport<=700?copyStyle.clipPath==="inset(50%)":copy.scrollWidth<=copy.clientWidth+2),
   fontPx:parseFloat(copyStyle?.fontSize),titleFont:parseFloat(getComputedStyle(title).fontSize),compactCopy:copyStyle.clipPath==="inset(50%)",titleInk:getComputedStyle(title).color,copyInk:copyStyle.color,iconInk:getComputedStyle(svg).stroke,icon:svg?.getAttribute("aria-hidden")==="true"};
 });
 const railDisplay={background:getComputedStyle(rail).backgroundColor,
  columns:getComputedStyle(rail).gridTemplateColumns.trim().split(/\\s+/).length,
  role:rail.getAttribute("role"),ariaHidden:rail.getAttribute("aria-hidden"),
  left:Math.round(railBox.left),right:Math.round(railBox.right),viewportRight:document.documentElement.clientWidth,overlap:composition.bottom-railBox.top,centered:Math.abs(railBox.left+railBox.right-viewport)<3,followedByServices:document.querySelector("#inicio").nextElementSibling?.id==="soluciones"};
 const participantGrid=document.querySelector("#vision .ecosystem-participants");
 const participantHeading=document.querySelector("#vision h2");
 const participantBounds=participantGrid.getBoundingClientRect(),headingBounds=participantHeading.getBoundingClientRect();
 const participantLayout={columns:getComputedStyle(participantGrid).gridTemplateColumns.trim().split(/\\s+/).length,
  headingAbove:headingBounds.bottom<=participantBounds.top+2,
  left:participantBounds.left,right:participantBounds.right,
  obsoleteNote:!!document.querySelector("#vision .ecosystem-participants-note")||document.querySelector("#vision").textContent.includes("Modelo de servicios en desarrollo."),
  cards:[...participantGrid.querySelectorAll(".ecosystem-participant")].map(c=>{
   const box=c.getBoundingClientRect(),image=c.querySelector("img"),p=c.querySelector("p"),h=c.querySelector("h3"),photo=c.querySelector(".ecosystem-participant__photo").getBoundingClientRect();
   return {title:h.textContent.trim(),src:image.getAttribute("src"),alt:image.alt,lazy:image.loading,
    inside:box.left>=participantBounds.left-2&&box.right<=participantBounds.right+2,
    fits:h.scrollWidth<=h.clientWidth+2&&(viewport<=700?getComputedStyle(p).clipPath==="inset(50%)":p.scrollWidth<=p.clientWidth+2),
    photoRatio:photo.width/photo.height,fit:getComputedStyle(image).objectFit,
    titleFont:parseFloat(getComputedStyle(h).fontSize),copyFont:parseFloat(getComputedStyle(p).fontSize)};
  })};
 const servicesGrid=document.querySelector("#soluciones .solutions-grid"),servicesBounds=servicesGrid.getBoundingClientRect(),servicesSheet=document.querySelector('link[href^="./styles.css?v="]');
 const servicesLayout={sheetLoaded:!!servicesSheet?.sheet,revision:servicesSheet?.getAttribute("href"),surface:getComputedStyle(servicesGrid.closest("section")).backgroundColor,gap:parseFloat(getComputedStyle(servicesGrid).gap),columns:getComputedStyle(servicesGrid).gridTemplateColumns.trim().split(/\\s+/).length,headingAbsent:!document.querySelector("#soluciones > h2"),label:document.querySelector("#soluciones").getAttribute("aria-label"),cards:[...servicesGrid.querySelectorAll("article.service")].map(c=>{
  const r=c.getBoundingClientRect(),h=c.querySelector("h3"),hr=h.getBoundingClientRect(),a=c.querySelector(".prime-service-cta,.desset-service-cta"),ar=a.getBoundingClientRect(),v=c.querySelector("video"),vr=v.getBoundingClientRect(),button=c.querySelector("button"),cs=getComputedStyle(c);
  return {brand:h.textContent.trim(),source:v.dataset.src,poster:v.getAttribute("poster"),muted:v.muted,loop:v.loop,inline:v.playsInline,ratio:r.width/r.height,full:Math.abs(vr.width-r.width)<2&&Math.abs(vr.height-r.height)<2,fit:getComputedStyle(v).objectFit,overlay:getComputedStyle(c,"::after").backgroundImage,titleColor:getComputedStyle(h).color,primeColor:h.querySelector("span")?getComputedStyle(h.querySelector("span")).color:null,primeStack:!h.querySelector("span")||getComputedStyle(h.querySelector("span")).display==="block",titleTop:hr.top-r.top,titleBottom:hr.bottom-r.top,ctaTop:ar.top-r.top,ctaBottom:r.bottom-ar.bottom,centered:Math.abs((hr.left+hr.right-r.left-r.right)/2)<2&&Math.abs((ar.left+ar.right-r.left-r.right)/2)<2,inside:ar.left>=r.left&&ar.right<=r.right&&ar.bottom<=r.bottom&&r.left>=servicesBounds.left-2&&r.right<=servicesBounds.right+2,extra:!!c.querySelector("strong,p,figcaption"),radius:parseFloat(cs.borderTopLeftRadius),cta:{href:a.getAttribute("href"),label:a.textContent.trim(),height:ar.height,widthRatio:ar.width/r.width,width:ar.width,background:getComputedStyle(a).backgroundColor,color:getComputedStyle(a).color},pause:!!button,height:r.height};
 })};
 const partnersGrid=document.querySelector("#negocios .audience-grid--compact");
 const partnersBounds=partnersGrid.getBoundingClientRect();
 const close=document.querySelector("#contacto"),heading=close.querySelector("h2"),lines=[...heading.querySelectorAll(".closing-line")],headingStyle=getComputedStyle(heading);
 const partnerLayout={closing:{joined:close.parentElement===partnersGrid.parentElement&&close.nextElementSibling===partnersGrid,background:getComputedStyle(close.parentElement).backgroundColor,headerBackground:getComputedStyle(close).backgroundColor,align:headingStyle.textAlign,font:parseFloat(headingStyle.fontSize),words:lines.map(l=>l.textContent.trim()),colors:lines.map(l=>getComputedStyle(l.querySelector("em")||l).color),decorAbsent:[close,...lines].every(l=>["::before","::after"].every(p=>["none","normal"].includes(getComputedStyle(l,p).content))),cardFonts:[...partnersGrid.querySelectorAll("h3")].map(h=>parseFloat(getComputedStyle(h).fontSize))},columns:getComputedStyle(partnersGrid).gridTemplateColumns.trim().split(/\\s+/).length,gap:parseFloat(getComputedStyle(partnersGrid).gap),
 cards:[...partnersGrid.querySelectorAll(":scope > article")].map(c=>{
  const r=c.getBoundingClientRect(),h=c.querySelector("h3"),p=c.querySelector("p"),a=c.querySelector("a"),s=getComputedStyle(c),ar=a.getBoundingClientRect();
  return {title:h.textContent.trim(),label:a.textContent.trim(),accessibleLabel:a.getAttribute("aria-label"),buttonBg:getComputedStyle(a).backgroundColor,buttonInk:getComputedStyle(a).color,buttonWidth:ar.width,cardContentWidth:c.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight),href:a.getAttribute("href"),height:r.height,inside:r.left>=partnersBounds.left-2&&r.right<=partnersBounds.right+2,fit:[h,a].every(e=>e.scrollWidth<=e.clientWidth+2)&&(viewport<=700?getComputedStyle(p).clipPath==="inset(50%)":p.scrollWidth<=p.clientWidth+2),tap:ar.height,icon:c.querySelector("svg")?.getAttribute("aria-hidden"),background:s.backgroundColor,border:s.borderTopWidth,radius:parseFloat(s.borderTopLeftRadius),shadow:s.boxShadow,decoration:getComputedStyle(c,"::before").content};
 })};
 const footerNav=document.querySelector(".corporate-footer");
 const footerLayout={columns:getComputedStyle(footerNav).gridTemplateColumns.trim().split(/\\s+/).length,links:[...footerNav.querySelectorAll("a")].map(e=>({href:e.getAttribute("href"),inside:e.getBoundingClientRect().left>=0&&e.getBoundingClientRect().right<=viewport+2,height:e.getBoundingClientRect().height})),groups:[...footerNav.querySelectorAll("strong")].map(e=>e.textContent),social:[...document.querySelectorAll(".footer-social a")].map(e=>({label:e.getAttribute("aria-label"),height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width})),center:getComputedStyle(document.querySelector(".footer-social")).justifyContent,socialBg:getComputedStyle(document.querySelector(".footer-social")).backgroundColor,copyrightBg:getComputedStyle(document.querySelector(".site-footer>p")).backgroundColor,copyright:document.querySelector(".site-footer>p").textContent};
 const mobileFooter=document.querySelector(".mobile-footer"),mobileGroups=[...mobileFooter.querySelectorAll("details")];
 const mobileFooterLayout={visible:getComputedStyle(mobileFooter).display!=="none",groups:mobileGroups.map(d=>{const summary=d.querySelector("summary"),height=summary.getBoundingClientRect().height;d.open=true;const links=[...d.querySelectorAll("a")].map(a=>({href:a.getAttribute("href"),height:a.getBoundingClientRect().height}));d.open=false;return {name:summary.textContent,height,links}})};
 const mobileGeometry={criticalPaint:[...document.querySelectorAll("#inicio .motion-line__inner,#inicio .hero-actions,#inicio .prime-photo-surface,#inicio .prime-photo-image")].map(e=>{const s=getComputedStyle(e);return {animation:s.animationName,opacity:s.opacity,filter:s.filter,transform:s.transform,clip:s.clipPath}}),photoFull:Math.abs(photo.width-composition.width)<2&&Math.abs(photo.height-composition.height)<2,ctaInside:(()=>{const a=document.querySelector("#inicio .hero-cta").getBoundingClientRect();return a.left>=type.left-2&&a.right<=type.right+2&&a.top>=composition.top&&a.bottom<=composition.bottom})(),header:document.querySelector(".site-header").getBoundingClientRect().height,heroCTA:document.querySelector("#inicio .hero-cta").getBoundingClientRect().height,heroCTAWidth:document.querySelector("#inicio .hero-cta").getBoundingClientRect().width,heroColumn:Math.round(type.width),photoRatio:photo.width/photo.height,corporateColumns:getComputedStyle(document.querySelector("#empresa-destacada .institutional-home-grid")).gridTemplateColumns.trim().split(/\\s+/).length};
 const typeSizes={
  heroCTA:parseFloat(getComputedStyle(document.querySelector("#inicio .hero-cta")).fontSize),
  serviceTitle:parseFloat(getComputedStyle(document.querySelector(".solutions .service--main h3")).fontSize),
  storyTitle:parseFloat(getComputedStyle(document.querySelector(".motion-story-unit h3")).fontSize)
 };

  const style=selector=>getComputedStyle(document.querySelector(selector));
  const palette={
   rootYellow:style(":root").getPropertyValue("--yellow").trim().toUpperCase(),
   stageYellow:style("#ecosistema").getPropertyValue("--yellow").trim().toUpperCase(),
   stageDesignGold:style("#ecosistema").getPropertyValue("--ds-10-gold").trim().toUpperCase(),
   stageVisualGold:style("#ecosistema").getPropertyValue("--v02-gold").trim().toUpperCase(),
   heroCTA:style("#inicio .hero-cta").borderTopColor,heroCTABg:style("#inicio .hero-cta").backgroundColor,
   businessCTA:style("#negocios .business-pitch-cta").backgroundColor,
   statementAccent:style("#vision h2 span").color,
   statementBackground:style("#vision").backgroundColor,
   homeHeader:style(".site-header").backgroundColor,
   homeRecent:!!document.querySelector(".institutional-recent"),
   homeCorporate:style("#empresa-destacada").backgroundColor,
   homeCorporateCard:style("#empresa-destacada .institutional-home-link").backgroundColor,
   homeNews:style("#noticias-destacadas").backgroundColor,
   homeTalent:style("#talento-destacado").backgroundColor,
   homeHero:style("#inicio").backgroundColor,
   footerBackground:style(".site-footer").backgroundColor,
   navContactBackground:style(".main-nav .nav-contact").backgroundColor,
   primeHeadingColor:style("#soluciones .service--prime h3").color,
   primeSubtitleColor:style("#soluciones .service--prime h3 span").color,
   brandNameInk:style(".site-header .brand-name").color,
   footerBrandInk:style(".footer-brand").color,
   footerCopyInk:style(".site-footer>p").color,
   institutionalInk:style(":root").getPropertyValue("--ds-30-ink").trim().toLowerCase(),
   stageInk:style("#ecosistema").getPropertyValue("--ink").trim().toLowerCase(),
   stageDesignInk:style("#ecosistema").getPropertyValue("--ds-30-ink").trim().toLowerCase(),
   stageInheritedColor:style("#ecosistema").color,
   heroHeadingColor:style("#inicio .v4-headline-a").color,
   heroCtaInk:style("#inicio .hero-cta").color,
   heroPhotoFallbackBg:style("#inicio .prime-photo-surface").backgroundColor
  };
 return {decorativeArrowCount:[...document.querySelectorAll("a,button,summary")].filter(e=>/[↗→➜]/.test(e.textContent)).length,viewport,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,logo,text,heroFit,messageFit,offscreen:nodes,railItems,railDisplay,typeSizes,palette,participantLayout,servicesLayout,partnerLayout,footerLayout,mobileFooterLayout,mobileGeometry,menuLabel:document.querySelector(".menu-button")?.getAttribute("aria-label"),disclosures:{technical:!!document.querySelector('.v4-architecture-details,.ecosystem-board,.v4-flow-board,section.ecosystem,.prime-3d-heading'),obsoleteServices:!!document.querySelector('.future-services')},navDisplay:getComputedStyle(document.querySelector('.main-nav')).display,animation:getComputedStyle(document.querySelector('.motion-line__inner')).animationName};
})()`);
 const fails=[];
 if(diag.scrollWidth>width+2)fails.push("horizontal scroll "+diag.scrollWidth+" > "+width);
  if(diag.disclosures.technical!==false||diag.disclosures.obsoleteServices)fails.push("Freshly navigated page: technical disclosure ABSENT; obsolete services absent: "+JSON.stringify(diag.disclosures));
  const expectedOriginal="rgb(255, 198, 47)";
  const brandBlue="rgb(7, 59, 188)",pureWhite="rgb(255, 255, 255)",paleBlue="rgb(244, 248, 254)";
  const palette=diag.palette;
  // The final computed color is checked only after the background settles.
  // Never accept a semi-transparent or differently colored CTA as a PASS.
  const whiteChannels=palette.heroCTA.match(/^rgba?\(255,\s*255,\s*255(?:,\s*([\d.]+))?\)$/);
  const exactWhite=!!whiteChannels&&(whiteChannels[1]===undefined||
   (Number(whiteChannels[1])>=.9999&&Number(whiteChannels[1])<=1));
  if(palette.rootYellow!=="#FFC62F"||palette.stageYellow!=="#FFC62F"||
   palette.stageDesignGold!=="#FFC62F"||palette.stageVisualGold!=="#FFC62F"||
   !exactWhite||palette.businessCTA!==brandBlue||
   palette.statementAccent!==brandBlue||palette.statementBackground!==pureWhite||
   palette.homeHeader!=="rgba(0, 0, 0, 0)"||palette.homeRecent||palette.homeCorporate!==paleBlue||palette.homeCorporateCard!==pureWhite||palette.homeNews!==pureWhite||palette.homeTalent!=="rgb(245, 245, 245)"||palette.homeHero!=="rgb(245, 245, 245)"||
   palette.footerBackground!=="rgb(10, 10, 10)"||palette.navContactBackground!=="rgba(0, 0, 0, 0)"||
   palette.primeHeadingColor!==brandBlue||palette.primeSubtitleColor!==brandBlue||
   palette.institutionalInk!=="#000000"||
   palette.stageInk!=="#111111"||palette.stageDesignInk!=="#111111"||palette.stageInheritedColor!=="rgb(17, 17, 17)"||
   palette.heroHeadingColor!==pureWhite||
   palette.heroCtaInk!==pureWhite||palette.heroCTABg!=="rgba(0, 0, 0, 0)"||
   palette.heroPhotoFallbackBg!=="rgb(16, 16, 16)"||
   palette.brandNameInk!==pureWhite||
   palette.footerBrandInk!==pureWhite||palette.footerCopyInk!=="rgb(86, 86, 86)")
   fails.push("HERO-EDITORIAL-02: hero CTA must use opaque white outline and white text; brand yellow preserved, home surfaces neutral and 3D controls white: "+JSON.stringify(palette));
 if(diag.text.some(t=>t.contentWidth>t.visibleWidth+2))fails.push("clipped hero headline");
 if(diag.messageFit.buttons!==0||!diag.messageFit.fullWidth||!diag.messageFit.aboveCTA||!diag.messageFit.inside||diag.messageFit.rows.length!==4||!diag.messageFit.rows.every(Boolean))fails.push("HERO-MESSAGES-02 full-width, no controls, no overflow: "+JSON.stringify(diag.messageFit));
 if(diag.heroFit.typeLeft<diag.heroFit.compositionLeft-2 ||
    diag.heroFit.rows.length!==2 ||
    diag.heroFit.rows.some(line=>line.contentLeft<line.lineLeft-2||
     line.contentRight>line.lineRight+2||line.contentRight>diag.heroFit.typeRight+2) ||
    (diag.heroFit.photoLeft>diag.heroFit.typeRight+3 &&
     diag.heroFit.rows.some(line=>line.contentRight>diag.heroFit.photoLeft-18)))
   fails.push("HERO-FIT-02: approved headline escaped text column or entered photo: "+JSON.stringify(diag.heroFit));
 if(diag.logo.some(x=>x.loading!=="lazy"&&(!x.complete||x.naturalWidth===0)))fails.push("broken eager image");
 if(diag.offscreen.some(x=>!x.className.includes("skip-link") && !x.className.includes("hero-symbol-echoes") && !x.className.includes("hero-stage") && !x.className.includes("art-")))fails.push("element off-screen: "+JSON.stringify(diag.offscreen));
 if(reduce&&diag.animation!=="none")fails.push("reduced motion did not disable animation");
 if(diag.railItems.length!==4||diag.railItems.some(i=>!i.visible||!i.inside||!i.textFits||!i.icon||i.fontPx<12||(width<=700&&(!i.compactCopy||i.titleFont<11))||i.titleInk!=="rgb(0, 0, 0)"||i.copyInk!=="rgb(34, 34, 34)"||i.iconInk!=="rgb(0, 0, 0)")||
    diag.railDisplay.background!==expectedOriginal||diag.railDisplay.role!=="list"||diag.railDisplay.ariaHidden!==null||
    diag.railDisplay.columns!==(width<=700?4:width<=860?2:4)||
   !diag.railDisplay.centered||diag.railDisplay.left<0||diag.railDisplay.right>diag.railDisplay.viewportRight||diag.railDisplay.overlap<20||!diag.railDisplay.followedByServices)
   fails.push("HERO-SERVICE-01: accessible service strip clips content or has wrong layout: "+JSON.stringify({items:diag.railItems,layout:diag.railDisplay}));
 const participants=diag.participantLayout;
 const expectedParticipantTitles=["PROVEEDORES","COMERCIOS","PERSONAS","OPERADORES LOGÍSTICOS"];
 const expectedParticipantFiles=["./assets/ecosistema-proveedores.webp","./assets/ecosistema-comercios.webp","./assets/ecosistema-consumidores.webp","./assets/ecosistema-operadores-logisticos.webp"];
 if(participants.columns!==(width<320?1:width<=1000?2:4)||!participants.headingAbove||participants.left< -2||participants.right>diag.viewport+2||
  participants.obsoleteNote||participants.cards.length!==4||
  participants.cards.some((c,i)=>c.title!==expectedParticipantTitles[i]||c.src!==expectedParticipantFiles[i]||!c.alt||c.lazy!=="lazy"||!c.inside||!c.fits||Math.abs(c.photoRatio-1.5)>.03||c.fit!=="cover"||c.titleFont<(width<=700?13:17)||c.copyFont<14))
  fails.push("ECOSYSTEM-PARTICIPANTS-01 responsive layout, card order or text clipping: "+JSON.stringify(participants));
  const services=diag.servicesLayout;
  if(!services.sheetLoaded||!services.headingAbsent||services.label!=="Servicios y aplicaciones DESSET"||services.columns!==(width<=700?1:2)||services.cards.length!==2||services.cards.map(c=>c.brand).join("|")!=="DESSET|DESSET prime"||
   services.cards.some((c,i)=>c.source!==("./assets/servicio-"+(i?"prime":"desset")+".mp4")||c.poster!==("./assets/servicio-"+(i?"prime":"desset")+"-poster.webp")||!c.muted||!c.loop||!c.inline||!c.full||c.fit!=="cover"||!c.overlay.includes("linear-gradient")||c.titleColor!==(i?brandBlue:pureWhite)||(i===1&&c.primeColor!==brandBlue)||!c.primeStack||!c.centered||!c.inside||c.extra||c.pause||c.radius!==12||Math.abs(c.ratio-16/9)>.04||c.titleTop<=0||c.ctaBottom<=0||c.titleBottom>=c.ctaTop||c.cta.label!=="Conocer más"||c.cta.height<(width<=700?48:56)||Math.abs(c.cta.widthRatio-(width<=700?.78:Math.min(.65,560/(c.height*16/9))))>.025||c.cta.background!==pureWhite||c.cta.color!==brandBlue||c.cta.href!==(i?"./prime.html":"./aplicaciones.html")))
    fails.push("Two visible responsive service brands: "+JSON.stringify(services));
  if(diag.decorativeArrowCount!==0)fails.push("Decorative arrows remain in interactive controls");
 if((width>700&&diag.footerLayout.columns!==4)||diag.footerLayout.groups.join("|")!=="Empresa|Servicios|Aplicaciones|Contacto"||diag.footerLayout.links.length!==14||diag.footerLayout.links.map(x=>x.href).join("|")!=="./empresa.html#quienes-somos|./empresa.html#mision-vision|./empresa.html#valores|#soluciones|./prime.html|./aplicaciones.html|./comercios.html|./repartidores.html|./contacto.html|./confianza.html|./noticias.html|./talento.html|./en.html|./empresa.html#informacion-corporativa"||(width>700&&diag.footerLayout.links.some(x=>!x.inside||x.height<24))||diag.footerLayout.social.length!==5||diag.footerLayout.social.some(x=>x.width<44||x.height<44)||diag.footerLayout.center!=="center"||diag.footerLayout.socialBg!=="rgb(245, 245, 245)"||diag.footerLayout.copyrightBg!=="rgb(245, 245, 245)"||diag.footerLayout.copyright!=="© 2026 DESSET. Todos los derechos reservados.")fails.push("Corporate footer layout: "+JSON.stringify(diag.footerLayout));
 const mf=diag.mobileFooterLayout;
 if(mf.visible!==(width<=700)||(width<=700&&(mf.groups.map(g=>g.name).join("|")!=="Empresa|Servicios|Aplicaciones|Contacto"||mf.groups.some(g=>g.height<44||g.links.some(l=>l.height<44))||mf.groups.flatMap(g=>g.links.map(l=>l.href)).join("|")!==diag.footerLayout.links.map(l=>l.href).join("|"))))fails.push("MOBILE-01 compact accessible footer: "+JSON.stringify(mf));
 const partners=diag.partnerLayout;
 const cl=partners.closing;
 if(!cl.joined||cl.background!==pureWhite||cl.headerBackground!=="rgba(0, 0, 0, 0)"||cl.align!=="center"||cl.words.join("|")!=="LAS BUENAS CONEXIONES|COMIENZAN AQUÍ"||cl.colors.join("|")!=="rgb(0, 0, 0)|rgb(7, 59, 188)"||!cl.decorAbsent||cl.cardFonts.some(f=>f<=cl.font))fails.push("CONTACT-03 unified closing hierarchy: "+JSON.stringify(cl));
  if(partners.columns!==(width<320?1:2)||partners.gap!==(width<=700?10:16)||partners.cards.length!==2||
   partners.cards.map(c=>c.title).join("|")!=="Comercios|Repartidores"||
   partners.cards.map(c=>c.label).join("|")!=="Más información|Más información"||
   partners.cards.map(c=>c.accessibleLabel).join("|")!=="Más información para comercios|Más información para repartidores"||
   partners.cards.some(c=>!c.inside||!c.fit||c.href!==(c.title==="Comercios"?"./comercios.html":"./repartidores.html")||c.tap<48||c.icon!=="true"||c.border!=="1px"||c.radius!==20||c.shadow!=="none"||c.height>410||c.decoration!=="none"||c.buttonBg!==brandBlue||c.buttonInk!==pureWhite||Math.abs(c.buttonWidth-c.cardContentWidth)>2)||
   partners.cards[0].background!==pureWhite||partners.cards[1].background!=="rgb(255, 255, 255)"||
   Math.abs(partners.cards[0].height-partners.cards[1].height)>2)
    fails.push("Partner cards responsive parity: "+JSON.stringify(partners));
  if(width<=700){
   const g=diag.mobileGeometry;
   if(g.criticalPaint.length!==5||g.criticalPaint.some(s=>s.animation!=="none"||s.opacity!=="1"||s.filter!=="none"||s.transform!=="none"||s.clip!=="none")||!g.photoFull||!g.ctaInside||Math.abs(g.header-64)>1||g.heroCTA<48||g.heroCTAWidth>g.heroColumn+2||g.corporateColumns!==1)fails.push("MOBILE-01 compact geometry: "+JSON.stringify(g));
   if(!diag.menuLabel?.startsWith("Menú"))fails.push("Mobile menu accessible name must include visible Menú label: "+diag.menuLabel);
  if(diag.typeSizes.heroCTA<14||diag.typeSizes.serviceTitle<23||diag.typeSizes.storyTitle<13)fails.push("mobile content typography below release thresholds: "+JSON.stringify(diag.typeSizes));
 }
 report.viewports.push({width,height,reduce,source:entry===URL?"source":"dist",...diag,failures:fails});
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
 const heroQuality=await js(`(()=>({headline:document.querySelector("#hero-title")?.textContent?.replace(/\\s+/g," ").trim(),art:!!document.querySelector(".v4-motion-canvas"),oldDiagram:!!document.querySelector("#inicio .system-illustration"),brand:document.querySelector(".site-header .brand-mark")?.getAttribute("src"),flow:!!document.querySelector("#ecosistema .prime-service-cta"),unapprovedAutoPublish:!!document.querySelector("[data-deploy]")}))()`);
 if(heroQuality.headline!=="TU TIEMPO VALE MÁS"||!heroQuality.art||heroQuality.oldDiagram||!heroQuality.flow||!heroQuality.brand?.includes("deliver-assets-mark.png")||heroQuality.unapprovedAutoPublish) report.failures.push("V4 visual contract failed: "+JSON.stringify(heroQuality));
 report.tests.push({name:"V4 motion/design contract",heroQuality});
 const heroPhoto=await js('(()=>{const x=document.querySelector("#inicio .prime-photo-image");const f=document.querySelector("#inicio .prime-photo-surface");return {loaded:!!x?.complete&&x.naturalWidth===1920&&x.naturalHeight===960,src:x?.getAttribute("src"),logo:document.querySelector(".site-header .brand-mark")?.getAttribute("src"),oldText:document.querySelector("#inicio")?.textContent?.includes("IDEAS EN ACCIÓN"),ratio:f?.getBoundingClientRect().width/f?.getBoundingClientRect().height}})()');
 if(!heroPhoto.loaded||!heroPhoto.src?.endsWith("desset-hero-editorial-poster.webp")||
    !heroPhoto.logo?.endsWith("deliver-assets-mark.png")||heroPhoto.oldText||heroPhoto.ratio<1.2)
    report.failures.push("HERO-PHOTO-01 exact local render, original logo, conceptual disclosure failed: "+JSON.stringify(heroPhoto));
 report.tests.push({name:"HERO-PHOTO-01 exact local render, original logo, conceptual disclosure",heroPhoto});
 await until(async()=>await js('(()=>{const v=document.querySelector("#desset-editorial-video");return v.readyState>=2&&v.videoWidth===1920&&v.videoHeight===960&&v.loop&&v.muted&&!v.paused&&v.currentTime>0})()'),"editorial hero video playing");
 const heroPlayback=await js('(()=>{const v=document.querySelector("#desset-editorial-video"),t=document.querySelector(".desset-editorial-stage"),r=t.getBoundingClientRect(),p=v.getBoundingClientRect(),h=document.querySelector(".site-header").getBoundingClientRect(),c=document.querySelector(".v4-hero-type").getBoundingClientRect();return {source:v.dataset.src,ready:v.dataset.ready,loop:v.loop,muted:v.muted,inline:v.playsInline,controls:v.controls,buttons:t.querySelectorAll("button").length,fit:getComputedStyle(v).objectFit,full:Math.abs(r.width-p.width)<2&&Math.abs(r.height-p.height)<2,headerOverlay:Math.abs(h.top-r.top)<2&&h.bottom<r.bottom,copyRight:c.left>=r.left+r.width*.5,compact:r.height/innerHeight}})()');
 if(heroPlayback.source!=="./assets/desset-hero-editorial.mp4"||heroPlayback.ready!=="true"||!heroPlayback.loop||!heroPlayback.muted||!heroPlayback.inline||heroPlayback.controls||heroPlayback.buttons!==0||heroPlayback.fit!=="cover"||!heroPlayback.full||!heroPlayback.headerOverlay||!heroPlayback.copyRight||heroPlayback.compact<.70||heroPlayback.compact>.82)report.failures.push("HERO-EDITORIAL-02 playback/geometry "+JSON.stringify(heroPlayback));
 report.tests.push({name:"HERO-EDITORIAL-02 full video, integrated header and no added controls",heroPlayback});
 const heroMessages=await js('(()=>{const c=document.querySelector("#hero-messages");return {active:c.querySelectorAll("[aria-hidden=false]").length,cues:[...c.querySelectorAll("[data-at]")].map(e=>Number(e.dataset.at)),fits:c.scrollWidth<=c.clientWidth+2,buttons:document.querySelector("#inicio .desset-editorial-stage").querySelectorAll("button").length}})()');
 if(heroMessages.buttons!==0||heroMessages.active!==1||heroMessages.cues.join("|")!=="0|2.4|4.4|7.8"||!heroMessages.fits)report.failures.push("HERO-MESSAGES-02 scene cues without extra control "+JSON.stringify(heroMessages));
 report.tests.push({name:"HERO-MESSAGES-02 synchronized messages without added control",heroMessages});
 const roundedUI=await js('(()=>{const sels={hero:".v4-motion-canvas",cta:".hero-cta",card:".solutions-grid .service--main",pitch:".business-pitch"};return {titles:[...document.querySelectorAll("h1,h2,h3")].map(e=>e.textContent.trim()),radii:Object.fromEntries(Object.entries(sels).map(([name,sel])=>[name,parseFloat(getComputedStyle(document.querySelector(sel)).borderTopLeftRadius)||0]))}})()');
 const decorDots=roundedUI.titles.filter(t=>t.endsWith("."));
 if(decorDots.length||Object.entries(roundedUI.radii).some(([key,v])=>key==="hero"?v!==0:key==="cta"?v!==999:v<10))
   report.failures.push("V6.6 unexpected heading periods or missing rounded corners: "+JSON.stringify({decorDots,radii:roundedUI.radii}));
 report.tests.push({name:"V6.6 editorial punctuation and computed corner radii",roundedUI});

 const designSystem=await js('(()=>{const color=sel=>getComputedStyle(document.querySelector(sel)).backgroundColor;return {body:color("body"),contact:color(".contact"),feature:color(".solutions-grid .service--main"),brand:color(".business-pitch"),cssLoaded:[...document.styleSheets].some(s=>s.href?.endsWith("/styles-system.css")),steps:[...document.querySelectorAll(".motion-story-unit h3")].map(e=>e.textContent.trim())}})()');
 const expectedSteps=["PROVEEDORES","COMERCIOS","PERSONAS","OPERADORES LOGÍSTICOS"];
 if(!designSystem.cssLoaded||
    designSystem.body!=="rgb(247, 245, 238)"||
    designSystem.contact!=="rgba(0, 0, 0, 0)"||
    designSystem.feature!=="rgb(35, 35, 35)"||
    designSystem.brand!=="rgb(255, 255, 255)"||
    JSON.stringify(designSystem.steps)!==JSON.stringify(expectedSteps))
   report.failures.push("V6.7 computed 60-30-10 palette or four-participant narrative mismatch: "+JSON.stringify(designSystem));
 report.tests.push({name:"V6.7 palette 60-30-10 and editorial journey computed in browser",designSystem});
 const visual02=await js('(()=>{const q=s=>document.querySelector(s);const cs=s=>getComputedStyle(q(s));return {cssLoaded:[...document.styleSheets].some(x=>x.href?.endsWith("/styles-visual02.css")),heroPhoto:q("#inicio .prime-photo-image")?.getAttribute("src"),heroLogo:q(".site-header .brand-mark")?.getAttribute("src"),heroCTA:q("#inicio .hero-cta")?.getAttribute("href"),businessShadow:cs("#negocios .business-pitch").boxShadow,serviceTop:cs("#soluciones .service--main").borderTopWidth,trustBg:cs("#vision").backgroundColor,mobileSafe:document.documentElement.scrollWidth<=document.documentElement.clientWidth+2}})()');
 if(!visual02.cssLoaded||!visual02.heroPhoto?.endsWith("desset-hero-editorial-poster.webp")||!visual02.heroLogo?.endsWith("deliver-assets-mark.png")||visual02.heroCTA!=="./mision-vision-valores.html#proposito"||
   visual02.serviceTop!=="0px"||visual02.trustBg!=="rgb(255, 255, 255)"||!visual02.mobileSafe)
  report.failures.push("VISUAL-02 institutional editorial consistency regression: "+JSON.stringify(visual02));
 report.tests.push({name:"VISUAL-02 corporate style, approved hero and responsive safety",visual02});

 const appAccess=await js('(()=>{const s=document.querySelector("#soluciones");return {panel:!!document.querySelector("[data-service-access],.service-access,[data-service-status],[data-app-links]"),obsoleteText:/APLICACIONES DESSET|Acceso público no habilitado/.test(s.textContent),storeLinks:[...document.querySelectorAll("a[href]")].filter(a=>["play.google.com","apps.apple.com"].includes(new URL(a.href).hostname)).length,cards:s.querySelectorAll(".solutions-grid article.service").length}})()');
 if(appAccess.panel||appAccess.obsoleteText||appAccess.storeLinks!==0||appAccess.cards!==2)
   report.failures.push("Services must contain only the two brands, no app availability panel or store links: "+JSON.stringify(appAccess));
 report.tests.push({name:"Two service cards only; app availability panel absent and no unverified store links",appAccess});
 const kineticIntro=await js('(()=>({version:document.documentElement.dataset.kineticVersion,headlinePx:parseFloat(getComputedStyle(document.querySelector(".motion-headline")).fontSize),leadAbsent:!document.querySelector("#inicio .hero-lead"),graphic:document.querySelector(".site-header .brand-mark")?.getAttribute("src"),photoLoaded:document.querySelector("#inicio .prime-photo-image")?.complete}))()');
 if(kineticIntro.version!=="v45"||kineticIntro.headlinePx<45||!kineticIntro.leadAbsent||!kineticIntro.graphic?.includes("deliver-assets-mark.png")||!kineticIntro.photoLoaded)report.failures.push("V4.5 visible hero/photo and original brand failed: "+JSON.stringify(kineticIntro));
 report.tests.push({name:"V4.5 visible headline, photograph and original mark",kineticIntro});
 const anim01=await js('(()=>({noScan:!document.querySelector(".v5-stage-scan"),noDecor:!document.querySelector("#inicio .v4-shape, #inicio .v4-canvas-stamp, #inicio .v5-hero-refraction, #inicio .motion-brand-thread"),direction:document.documentElement.dataset.motionDirection}))()');
 if(!anim01.noScan||!anim01.noDecor||anim01.direction!=="editorial-cinematic-v1")
  report.failures.push("ANIM-01 obsolete ornament or arcade overlay detected: "+JSON.stringify(anim01));
 report.tests.push({name:"ANIM-01 no scanner, glint, cursor-game lens or bouncing hero",anim01});
 const anim02=await js('(()=>({photo:getComputedStyle(document.querySelector("#inicio .prime-photo-surface")).animationName,focus:getComputedStyle(document.querySelector("#inicio .prime-photo-image")).animationName,title:getComputedStyle(document.querySelector("#inicio .v4-headline-a .motion-line__inner")).animationName,cta:getComputedStyle(document.querySelector("#inicio .hero-actions")).animationName,chapters:document.documentElement.dataset.anim02,approvedSrc:document.querySelector("#inicio .prime-photo-image")?.getAttribute("src"),logo:document.querySelector(".brand-mark")?.getAttribute("src")}))()');
 if(anim02.photo!=="none"||anim02.focus!=="none"||anim02.title!=="none"||anim02.cta!=="none"||anim02.chapters!=="cinematic-chapters"||
   !anim02.approvedSrc?.endsWith("desset-hero-editorial-poster.webp")||!anim02.logo?.endsWith("deliver-assets-mark.png"))
  report.failures.push("ANIM-02 original DESSET hero/finite cinematography contract failed: "+JSON.stringify(anim02));
 report.tests.push({name:"ANIM-02 real photographic opening, official mark, editorial chronology",anim02});


 const smallUI=await js('(()=>{const selector=".header-descriptor,.v4-hero-caption,.hero-kicker,.v4-canvas-top,.v4-canvas-bottom,.hero-meta,.section-label,.kicker,.service-top,.ecosystem-board-top,.motion-story-index,.motion-story-status,.audience-no,.audience-tag,.business-pitch-top,.closing-kicker-signal";return {decorativeLabelCount:document.querySelectorAll(selector).length,numberedTokens:document.body.textContent.match(/\\b0[1-9]\\s*\\/\\s*/g)||[],statement:document.querySelector("#vision h2")?.textContent?.trim(),removedBlocks:document.querySelectorAll(".trust-ledger,.statement-side,.section-head,.ecosystem-footnote,.hero-secondary").length}})()');
 if(smallUI.decorativeLabelCount!==0||smallUI.numberedTokens.length!==0||!smallUI.statement?.includes("ES CONECTAR")||smallUI.removedBlocks!==0)report.failures.push("Editorial numeric labels survived cleanup: "+JSON.stringify(smallUI));
 report.tests.push({name:"Zero editorial numeric labels and redundant tiny captions",smallUI});
 await capture("desktop-entry.png");
 await sleep(1100);
 await capture("desktop-transition.png");
 await sleep(2050);
 await capture("desktop-final.png");
 
  const v5Cover=await js('(()=>({mode:document.documentElement.dataset.v5Mode,overlayAbsent:!document.querySelector(".v5-hero-refraction"),stage:!!document.querySelector(".v5-city-stage,.v6-three-mount"),diagram:!!document.querySelector(".roles-diagram-responsive"),link:!!document.querySelector("#ecosistema .prime-service-cta"),noPoster:!document.querySelector(".v5-responsive-art,.v5-stage-render,.v5-stage-scan"),contactLight:!!document.querySelector(".v5-contact-light")}))()');
  if(v5Cover.mode!=="ready"||!v5Cover.overlayAbsent||v5Cover.stage||v5Cover.diagram||!v5Cover.link||!v5Cover.noPoster||v5Cover.contactLight)report.failures.push("Home must not mount logistics WebGL or old diagram: "+JSON.stringify(v5Cover));
  report.tests.push({name:"Home is free of logistics 3D and obsolete diagram",v5Cover});
   // Capture full page after activation without any poster image.
   await capture("desktop-full.png",true);
 await js('document.querySelector(".motion-story").scrollIntoView({block:"center",behavior:"instant"})');
 await sleep(450);
 const storyState=await js('({sequence:document.querySelector(".motion-story").classList.contains("motion-active"),cards:[...document.querySelectorAll(".motion-story-unit")].map(x=>({text:x.querySelector("h3")?.textContent,active:x.classList.contains("motion-active")}))})');
 if(!storyState.sequence||storyState.cards.length!==4||storyState.cards.some(x=>!x.active))report.failures.push("Narrative motion sequence not activated: "+JSON.stringify(storyState));
 report.tests.push({name:"Scroll-bound narrative sequence",storyState});
 const scenes=await js('(()=>[...document.querySelectorAll(".motion-story-art img")].map(el=>({src:el.getAttribute("src"),complete:el.complete,width:el.naturalWidth,height:el.naturalHeight,rendered:el.getBoundingClientRect().width})))()');
 if(scenes.length!==4||scenes.some(x=>!x.complete||x.width<100||x.height<100||x.rendered<45))report.failures.push("Commercial narrative illustrations missing or too small: "+JSON.stringify(scenes));
 report.tests.push({name:"Four local narrative photographs load",scenes});
 const v03=await js('(()=>[...document.querySelectorAll(".motion-story-art img")].map(x=>({src:x.getAttribute("src"),current:x.currentSrc,photo:!!x.closest("picture.v03-photo-story"),fit:getComputedStyle(x).objectFit,loaded:x.complete,width:x.naturalWidth,height:x.naturalHeight,alt:x.alt})))()');
 const v03Photos=["ecosistema-proveedores.webp","ecosistema-comercios.webp","ecosistema-consumidores.webp","ecosistema-operadores-logisticos.webp"];
 const v03Dimensions=[[1000,563],[750,1000],[1000,563],[1000,750]];
 if(v03.length!==4||new Set(v03.map(x=>x.current)).size!==4||v03.some((x,i)=>!x.photo||!x.current.endsWith(v03Photos[i])||x.fit!=="cover"||!x.loaded||!x.src.endsWith(v03Photos[i])||x.width!==v03Dimensions[i][0]||x.height!==v03Dimensions[i][1]||!x.alt))
  report.failures.push("ECOSYSTEM-PARTICIPANTS-01 distinct approved WebP photographs or exact dimensions failed: "+JSON.stringify(v03));
 report.tests.push({name:"ECOSYSTEM-PARTICIPANTS-01 four different approved photos, exact sizes, alternative text",v03});

 await capture("desktop-story-motion.png");
 const kineticJourney=await js('(()=>{const cards=[...document.querySelectorAll(".motion-story-unit")].map(c=>({active:c.classList.contains("motion-active"),animation:getComputedStyle(c.querySelector("img")).animationName}));return {cards,noBridge:!document.querySelector(".motion-story-bridge"),noHeroLabel:!document.querySelector(".v4-hero-declaration")}})()');
 if(kineticJourney.cards.length!==4||kineticJourney.cards.some(x=>!x.active||x.animation!=="none")||!kineticJourney.noBridge||!kineticJourney.noHeroLabel)report.failures.push("Four-participant photography must remain stable: "+JSON.stringify(kineticJourney));
 report.tests.push({name:"ECOSYSTEM-PARTICIPANTS-01 stable documentary photography, existing scroll cue",kineticJourney});
 await sleep(1250);
 await capture("desktop-story-final.png");
 await js('document.querySelector("#contacto").scrollIntoView({block:"center",behavior:"instant"})');
 await sleep(450);
 const closing=await js('[...document.querySelectorAll(".closing-line")].map(x=>({word:x.textContent.trim(),active:x.classList.contains("motion-active")}))');
 if(closing.length!==2||closing.some(x=>!x.active))report.failures.push("Closing editorial sequence not activated: "+JSON.stringify(closing));
 report.tests.push({name:"Brand closing motion",closing});
 const closingInk=await js('(()=>[...document.querySelectorAll(".contact .closing-line")].map(e=>({text:e.textContent.trim(),opacity:Number(getComputedStyle(e).opacity)})))()');
 if(closingInk.some(x=>x.opacity<.99))report.failures.push("V6.7 contact heading loses contrast during motion: "+JSON.stringify(closingInk));
 report.tests.push({name:"V6.7 closing headline remains opaque during cinema animation",closingInk});
 await capture("desktop-closing-motion.png");
 const kineticFinale=await js('(()=>{const contact=document.querySelector("#contacto"),middle=contact.querySelector(".closing-line--final");return {active:contact.classList.contains("motion-active"),lineAnimation:getComputedStyle(middle).animationName,underlineAnimation:getComputedStyle(middle,"::after").animationName,slashAnimation:getComputedStyle(contact,"::after").animationName}})()');
 if(!kineticFinale.active||kineticFinale.lineAnimation!=="v45-closing-reveal"||kineticFinale.underlineAnimation!=="none"||kineticFinale.slashAnimation!=="none")report.failures.push("Kinetic final contact scene failed: "+JSON.stringify(kineticFinale));
 report.tests.push({name:"CONTACT-03 closing without underline or slash",kineticFinale});
 const v5Finale=await js('(()=>{const e=document.querySelector("#contacto"),light=e.querySelector(".v5-contact-light");return {visible:e.classList.contains("v5-visible"),lightAbsent:!light}})()');
 if(!v5Finale.visible||!v5Finale.lightAbsent)report.failures.push("CONTACT-03 retired ambient light returned: "+JSON.stringify(v5Finale));
 report.tests.push({name:"V5 ambient finale",v5Finale});
 await sleep(1250);
 await capture("desktop-closing-final.png");
 await js('document.querySelector("#negocios").scrollIntoView({block:"center",behavior:"instant"})');
 await sleep(350);
 const pitch=await js('(()=>{const section=document.querySelector(".business-pitch");const anchor=section.querySelector("a.business-pitch-cta");return {heading:section.querySelector("h3")?.textContent?.replace(/\\s+/g," ").trim(),href:anchor?.getAttribute("href"),label:anchor?.textContent?.trim(),visible:section.getBoundingClientRect().height>180}})()');
 if(!pitch.visible||pitch.href!=="./comercios.html"||pitch.heading!=="Comercios"||pitch.label!=="Más información")report.failures.push("Business CTA not credible or inaccessible: "+JSON.stringify(pitch));
 report.tests.push({name:"Commercial pitch CTA",pitch});
 await capture("desktop-business-pitch.png");
 const rc=await js('(()=>{const h=document.querySelector(".hero-cta");const services=document.querySelector("#soluciones .solutions-grid");const prim=document.querySelector(".footer-social a[data-footer-channel=Instagram]");const count=[...document.querySelectorAll("h1")].length;return {primaryHref:h.getAttribute("href"),obsoleteServices:!!document.querySelector(".future-services"),serviceCards:services.querySelectorAll(".service").length,contactHref:prim.getAttribute("href"),contactText:prim.getAttribute("aria-label"),contactTarget:prim.getAttribute("target"),oldContact:!!document.querySelector(".contact-bottom,.contact-primary,.social-links--official"),headingCount:count,removedResponsibility:!document.querySelector(".responsibility")}})()');
 if(rc.primaryHref!=="./mision-vision-valores.html#proposito"||rc.obsoleteServices||rc.serviceCards!==2||!rc.contactHref.startsWith("https://www.instagram.com/")||rc.contactTarget!=="_blank"||rc.oldContact||rc.contactText!=="Instagram"||rc.headingCount!==1||!rc.removedResponsibility)report.failures.push("RC funnel and honesty contract failed: "+JSON.stringify(rc));
 report.tests.push({name:"V4.3 commercial focus & primary contact",rc});
 const socials=await js('(()=>{const nav=document.querySelector(".footer-social");const links=[...nav?.querySelectorAll("a")||[]];return {count:links.length,navLabel:nav?.getAttribute("aria-label"),oldBlock:!!document.querySelector(".contact-bottom,.contact-primary,.social-links--official,.social-links--secondary"),links:links.map(a=>({name:a.getAttribute("aria-label"),href:a.href,owner:a.dataset.channelBasis,review:a.dataset.channelReview,height:Math.round(a.getBoundingClientRect().height),background:getComputedStyle(a).backgroundColor,border:getComputedStyle(a).borderTopColor})),width:Math.round(nav?.getBoundingClientRect().width||0)}})()');
 if(socials.count!==5||socials.navLabel!=="Redes sociales oficiales en el pie de página"||socials.oldBlock||
  socials.links.map(x=>x.name).join("|")!=="Instagram|Facebook|TikTok|YouTube|X"||
  socials.links.some(x=>x.owner!=="owner-attested"||x.review!=="owner-attested"||x.height<44||!x.href.startsWith("https://"))||
  new Set(socials.links.map(x=>x.background)).size!==1||
  new Set(socials.links.map(x=>x.border)).size!==1)
  report.failures.push("One equal five-platform 60/30/10 social rail missing: "+JSON.stringify(socials));
 report.tests.push({name:"SOCIAL-05 five equal owner-declared channels in one navigation",socials});
 await js('document.querySelector("#soluciones").scrollIntoView({block:"center",behavior:"instant"})');
  await sleep(180);
  await capture("desktop-services.png");
  report.tests.push({name:"Two permanent service brands, no obsolete disclosure",services:d.servicesLayout});
  await js('document.querySelector("#vision").scrollIntoView({block:"center",behavior:"instant"})');
  await sleep(180);
   const leanDesktop=await js("(()=>{const x=document.querySelector(\"#vision\"),b=x.querySelector(\".statement-body\"),h=x.querySelector(\"h2\"),j=x.querySelector(\".statement-journey\"),t=h.getBoundingClientRect(),r=j.getBoundingClientRect(),last=h.querySelector(\".statement-last\").getBoundingClientRect(),cards=[...j.querySelectorAll(\".motion-story-unit\")];return {children:b.children.length,cols:getComputedStyle(j.querySelector(\".ecosystem-participants\")).gridTemplateColumns.split(\" \").length,text:h.textContent.trim(),left:t.left,right:t.right,titleContentRight:last.right,titleBottom:t.bottom,journeyTop:r.top,journeyLeft:r.left,journeyRight:r.right,storyCards:cards.length,photos:cards.map(c=>c.querySelector(\"img\").getBoundingClientRect().width),viewport:document.documentElement.clientWidth,duplicates:x.querySelectorAll(\".statement-side,.trust-ledger\").length,empty3d:!document.querySelector(\"#ecosistema .motion-story-unit\"),scrollWidth:document.documentElement.scrollWidth}})()");
   if(leanDesktop.children!==2||leanDesktop.cols!==4||leanDesktop.storyCards!==4||!leanDesktop.empty3d||leanDesktop.duplicates!==0||leanDesktop.left< -2||leanDesktop.journeyRight>leanDesktop.viewport+2||leanDesktop.titleContentRight>leanDesktop.viewport+2||leanDesktop.titleBottom>leanDesktop.journeyTop+2||leanDesktop.scrollWidth>leanDesktop.viewport+2||leanDesktop.photos.some(w=>w<80)||!leanDesktop.text.includes("ES CONECTAR"))report.failures.push("PRIME-LAYOUT-01 desktop statement cards overlap or escaped to 3D: "+JSON.stringify(leanDesktop));
   report.tests.push({name:"PRIME-LAYOUT-01 desktop: heading above four documentary photographs",leanDesktop});
  await capture("desktop-lean-statement.png");
 assert.equal(d.logo.length>=2,true,"Expected original unchanged DESSET mark in header and visual composition");
 for(const [w,h] of [[1920,1080],[1180,820],[1100,850],[1024,768],[961,900],[960,900],[861,900],[860,900],[768,900],[700,900],[699,900],[430,932],[390,844],[360,800],[320,700]]){
  await viewport(w,h);
  await verifySharedNavigation("","index",w);
  if(w===1920||w===1024){
   await sleep(1450);
   await capture(w===1920?"desktop-1920-hero-fit.png":"desktop-1024-hero-fit.png");
  }
  if(w===390||w===320){
   // Simulate a script-unavailable page in the loaded DOM. This exercises
   // the exact no-JS CSS selector without needing a second browser session.
   const fallback=await js('(()=>{const root=document.documentElement;root.classList.remove("js-enabled");const nav=document.querySelector(".main-nav"),btn=document.querySelector(".menu-button"),header=document.querySelector(".site-header");const p={navDisplay:getComputedStyle(nav).display,menuDisplay:getComputedStyle(btn).display,headerHeight:header.getBoundingClientRect().height,links:[...nav.querySelectorAll("a:not(.nav-submenu a)")].map(a=>({text:a.textContent.trim(),height:a.getBoundingClientRect().height}))};root.classList.add("js-enabled");p.headerHeightAfter=header.getBoundingClientRect().height;return p})()');
   if(fallback.navDisplay!=="flex"||fallback.menuDisplay!=="none"||fallback.headerHeight<64||Math.abs(fallback.headerHeight-fallback.headerHeightAfter)>1||fallback.links.length<4||fallback.links.some(l=>l.height<42))
     report.failures.push("V6.8 no-JS mobile navigation failed: "+JSON.stringify(fallback));
   report.tests.push({name:"V6.8 resilient mobile navigation without JavaScript "+w,fallback});
   const radius=await js('(()=>({pitch:parseFloat(getComputedStyle(document.querySelector(".business-pitch")).borderTopLeftRadius),screen:document.documentElement.clientWidth}))()');
   if(radius.pitch<17)report.failures.push("V6.6 mobile curves missing: "+JSON.stringify(radius));
   report.tests.push({name:"V6.6 mobile curved surfaces "+w,radius});
  }
  if(w===390){
   await sleep(3200);
   await capture("mobile-final.png");
   
   await js('document.querySelector("#negocios").scrollIntoView({block:"start",behavior:"instant"})');
   await sleep(240);
   await capture("mobile-business-pitch.png");
   await js('document.querySelector(".footer-social a[data-footer-channel=Instagram]").scrollIntoView({block:"center",behavior:"instant"})');
   await sleep(100);
   const mobileContact=await js('(()=>{const a=document.querySelector(".footer-social a[data-footer-channel=Instagram]"),r=a.getBoundingClientRect(),v=document.documentElement.clientWidth;return {label:a.getAttribute("aria-label"),left:r.left,right:r.right,height:r.height,viewport:v}})()');
   if(mobileContact.left < -2||mobileContact.right>mobileContact.viewport+2||mobileContact.height<44)report.failures.push("Primary mobile contact clipped or too small: "+JSON.stringify(mobileContact));
   report.tests.push({name:"Mobile primary contact tap target",mobileContact});
   const socialMobile=await js('(()=>{const nav=document.querySelector(".footer-social"),v=document.documentElement.clientWidth;return {viewport:v,overflow:document.documentElement.scrollWidth>v+2,links:[...nav.querySelectorAll("a:not(.nav-submenu a)")].map(a=>({name:a.getAttribute("aria-label"),left:a.getBoundingClientRect().left,right:a.getBoundingClientRect().right,height:a.getBoundingClientRect().height}))}})()');
   if(socialMobile.overflow||socialMobile.links.length!==5||
    socialMobile.links.some(x=>x.left < -2||x.right>socialMobile.viewport+2||x.height<44))
    report.failures.push("Social link rail clipped on 390px mobile: "+JSON.stringify(socialMobile));
   report.tests.push({name:"SOCIAL-05 mobile five profiles visible and tappable",socialMobile});
   const mobileClosing=await js('(()=>[...document.querySelectorAll(".contact .closing-line")].map(e=>({text:e.textContent.trim(),opacity:Number(getComputedStyle(e).opacity)})))()');
   if(mobileClosing.some(x=>x.opacity<.99))report.failures.push("V6.7 mobile closing text loses opacity: "+JSON.stringify(mobileClosing));
   report.tests.push({name:"V6.7 mobile contact heading maintains legibility",mobileClosing});
   await capture("mobile-contact-final.png");
    await js('document.querySelector("#vision").scrollIntoView({block:"center",behavior:"instant"})');
    await sleep(160);
     const leanMobile=await js("(()=>{const x=document.querySelector(\"#vision\"),b=x.querySelector(\".statement-body\"),h=x.querySelector(\"h2\"),j=x.querySelector(\".statement-journey\"),t=h.getBoundingClientRect(),r=j.getBoundingClientRect(),last=h.querySelector(\".statement-last\").getBoundingClientRect(),cards=[...j.querySelectorAll(\".motion-story-unit\")];return {children:b.children.length,cols:getComputedStyle(j.querySelector(\".ecosystem-participants\")).gridTemplateColumns.split(\" \").length,left:t.left,right:t.right,titleRight:last.right,titleBottom:t.bottom,journeyTop:r.top,journeyLeft:r.left,journeyRight:r.right,storyCards:cards.length,photos:cards.map(c=>c.querySelector(\"img\").getBoundingClientRect().width),viewport:document.documentElement.clientWidth,duplicates:x.querySelectorAll(\".statement-side,.trust-ledger\").length,font:parseFloat(getComputedStyle(h).fontSize),scrollWidth:document.documentElement.scrollWidth,empty3d:!document.querySelector(\"#ecosistema .motion-story-unit\")}})()");
     if(leanMobile.children!==2||leanMobile.cols!==2||leanMobile.storyCards!==4||!leanMobile.empty3d||leanMobile.duplicates!==0||leanMobile.left< -2||leanMobile.journeyRight>leanMobile.viewport+2||leanMobile.titleRight>leanMobile.viewport+2||leanMobile.titleBottom>leanMobile.journeyTop+2||leanMobile.photos.some(w=>w<70)||leanMobile.scrollWidth>leanMobile.viewport+2||leanMobile.font<25)report.failures.push("PRIME-LAYOUT-01 mobile journey clips or overlaps heading: "+JSON.stringify(leanMobile));
     report.tests.push({name:"PRIME-LAYOUT-01 mobile: four approved photos and text fully visible",leanMobile});
    await capture("mobile-lean-statement.png");
   await js("document.querySelector('.menu-button').click()");
   const menu=await js("({expanded:document.querySelector('.menu-button').getAttribute('aria-expanded'),display:getComputedStyle(document.querySelector('.main-nav')).display})");
   if(menu.expanded!=="true"||menu.display==="none")report.failures.push("Mobile navigation did not open");
   await call("Input.dispatchKeyEvent",{type:"keyDown",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
   await call("Input.dispatchKeyEvent",{type:"keyUp",key:"Escape",code:"Escape",windowsVirtualKeyCode:27});
   const after=await js("({expanded:document.querySelector('.menu-button').getAttribute('aria-expanded'),focused:document.activeElement===document.querySelector('.menu-button')})");
   if(after.expanded!=="false"||!after.focused)report.failures.push("Escape did not close and focus mobile menu");
   report.tests.push({name:"mobile navigation + Escape",menu,after});
   const removedPanel=await js('(()=>({absent:!document.querySelector(".v4-architecture-details,.ecosystem-board,.v4-flow-board,section.ecosystem,.prime-3d-heading"),link:!!document.querySelector("#ecosistema .prime-service-cta")}))()');
   if(!removedPanel.absent||!removedPanel.link)report.failures.push("Retired accordion must be absent and Prime model link retained: "+JSON.stringify(removedPanel));
   report.tests.push({name:"Mobile retired accordion absent",removedPanel});
   if(await js('!!document.querySelector(".v5-city-stage,.v6-three-mount")'))report.failures.push("390px home unexpectedly mounts 3D");
   // Capture full page after activation without any poster image.
   const wholePageClosed=await js('(()=>({technical:!!document.querySelector(".v4-architecture-details,.ecosystem-board,.v4-flow-board,section.ecosystem,.prime-3d-heading"),obsoleteServices:!!document.querySelector(".future-services")}))()');
   if(wholePageClosed.technical||wholePageClosed.obsoleteServices)report.failures.push("390px full-page screenshot would misrepresent removed panel state: "+JSON.stringify(wholePageClosed));
   report.tests.push({name:"390px full-page capture: technical disclosure ABSENT, services visible",wholePageClosed});
   await capture("mobile-full.png",true);
  }
  if(w===320){
   const narrowContact=await js('(()=>{const a=document.querySelector(".footer-social a[data-footer-channel=Instagram]"),r=a.getBoundingClientRect(),v=document.documentElement.clientWidth;return {left:r.left,right:r.right,height:r.height,viewport:v}})()');
   if(narrowContact.left < -2||narrowContact.right>narrowContact.viewport+2||narrowContact.height<44)report.failures.push("320px contact button fail: "+JSON.stringify(narrowContact));
   await sleep(3200);
   await capture("mobile-320-final.png");
   
   if(await js('!!document.querySelector(".v5-city-stage,.v6-three-mount")'))report.failures.push("320px home unexpectedly mounts 3D");
   // Capture full page after activation without any poster image.
   const narrowPageClosed=await js('(()=>({technical:!!document.querySelector(".v4-architecture-details,.ecosystem-board,.v4-flow-board,section.ecosystem,.prime-3d-heading"),obsoleteServices:!!document.querySelector(".future-services")}))()');
   if(narrowPageClosed.technical||narrowPageClosed.obsoleteServices)report.failures.push("320px full-page screenshot would misrepresent removed panel state: "+JSON.stringify(narrowPageClosed));
   report.tests.push({name:"320px full-page capture: technical disclosure ABSENT, services visible",narrowPageClosed});
   await capture("mobile-320-full.png",true);
  }
  if([1024,768,430,390,320].includes(w)){
   await js('document.querySelector("#soluciones").scrollIntoView({block:"center",behavior:"instant"})');
   await sleep(700);
   await capture("services-"+w+"px.png");
  }
 }
 // Exercise both real video decoders and verify playback crosses the native loop boundary.
 await viewport(1440,900,false);
 await js('document.querySelector("#soluciones").scrollIntoView({block:"center",behavior:"instant"})');
 await until(async()=>await js('[...document.querySelectorAll("#soluciones video")].every(v=>v.loop&&!v.paused&&Number.isFinite(v.duration)&&v.duration>1&&v.currentTime>0)'),"both service videos playing");
 await js('[...document.querySelectorAll("#soluciones video")].forEach(v=>v.currentTime=v.duration-.35)');
 await sleep(1300);
 const loopEvidence=await js('[...document.querySelectorAll("#soluciones video")].map(v=>({loop:v.loop,paused:v.paused,ended:v.ended,time:v.currentTime,duration:v.duration}))');
 if(loopEvidence.length!==2||loopEvidence.some(v=>!v.loop||v.paused||v.ended||v.time>=v.duration-.35))report.failures.push("VIDEO-03 actual loop boundary failed: "+JSON.stringify(loopEvidence));
 report.tests.push({name:"VIDEO-03 both videos cross native loop boundary",loopEvidence});
 const reduced=await viewport(390,844,true);
 const mobilePhoto=await js('(()=>{const x=document.querySelector("#inicio .prime-photo-image");return {src:x?.currentSrc,width:x?.naturalWidth,height:x?.naturalHeight,loaded:!!x?.complete}})()');
 if(!mobilePhoto.loaded||!mobilePhoto.src?.includes("desset-hero-editorial-poster.webp")||mobilePhoto.width!==1920||mobilePhoto.height!==960)
  report.failures.push("HERO-PHOTO-01 mobile responsive photo not selected: "+JSON.stringify(mobilePhoto));
 report.tests.push({name:"HERO-EDITORIAL-01 panoramic poster loaded with reduced motion",mobilePhoto});
 const reducedHero=await js('(()=>{const v=document.querySelector("#desset-editorial-video");return v.paused&&!v.getAttribute("src")&&getComputedStyle(v).display==="none"&&!document.querySelector(".hero-message-pause")&&document.querySelector("#hero-messages [aria-hidden=false]").dataset.at==="0"&&!document.querySelector(".desset-editorial-toggle")})()');
 if(!reducedHero)report.failures.push("HERO-EDITORIAL-01 reduced-motion fallback must not load or play video");
 const reducedMode=await js("document.documentElement.dataset.motionSystem");
 if(reducedMode!=="reduced")report.failures.push("Motion fallback failed for reduced preference: "+String(reducedMode));
 const reducedAnimations=await js('(()=>({headline:document.querySelector(".motion-headline").textContent.trim(),cta:document.querySelector(".hero-cta").getAttribute("href"),closing:document.querySelector("#contact-title").textContent.trim(),noDecor:!document.querySelector("#inicio .v4-shape, #inicio .v4-canvas-stamp, #inicio .v5-hero-refraction, #inicio .motion-brand-thread")}))()');
 if(!reducedAnimations.noDecor||reducedAnimations.headline.replace(/\s+/g," ").trim()!=="TU TIEMPO VALE MÁS"||reducedAnimations.cta!=="./mision-vision-valores.html#proposito"||!reducedAnimations.closing.includes("CONEXIONES"))report.failures.push("V4.5 reduced motion/essential information failed: "+JSON.stringify(reducedAnimations));
 report.tests.push({name:"V4.5 full-fidelity reduced motion fallback",reducedAnimations});
 const anim02Reduced=await js('(()=>({photo:getComputedStyle(document.querySelector("#inicio .prime-photo-surface")).animationName,focus:getComputedStyle(document.querySelector("#inicio .prime-photo-image")).animationName,title:getComputedStyle(document.querySelector("#inicio .v4-headline-a .motion-line__inner")).animationName,cta:document.querySelector("#inicio .hero-cta")?.getAttribute("href"),captionAbsent:!document.querySelector("#inicio .prime-photo-caption")}))()');
 if(anim02Reduced.photo!=="none"||anim02Reduced.focus!=="none"||anim02Reduced.title!=="none"||anim02Reduced.cta!=="./mision-vision-valores.html#proposito"||!anim02Reduced.captionAbsent)
  report.failures.push("ANIM-02 reduced-motion accessibility contract failed: "+JSON.stringify(anim02Reduced));
 report.tests.push({name:"ANIM-02 reduced motion leaves approved image and copy static",anim02Reduced});

  if(await js('!!document.querySelector(".v5-city-stage,.v6-three-mount")'))report.failures.push("Reduced-motion home unexpectedly mounts 3D");
 await capture("mobile-reduced-motion.png");
 report.tests.push({name:"reduced motion",animation:reduced.animation});

 // V5.4 CDP keyboard accessibility: synthetic interactions, not a manual screen-reader audit.
 const pressKey=async(key,code,keyCode)=>{
  // Chrome CDP expects a printable control character for native Enter activation.
  // raw keyDown without the CR text changes focus but does not generate click.
  const press={type:"keyDown",key,code,windowsVirtualKeyCode:keyCode,nativeVirtualKeyCode:keyCode};
  if(key==="Enter"){press.text=String.fromCharCode(13);press.unmodifiedText=String.fromCharCode(13);}
  await call("Input.dispatchKeyEvent",press);
  await call("Input.dispatchKeyEvent",{type:"keyUp",key,code,windowsVirtualKeyCode:keyCode,nativeVirtualKeyCode:keyCode});
 };
 await pressKey("Tab","Tab",9);
 const skipFocus=await js('(()=>{const e=document.activeElement,r=e.getBoundingClientRect(),s=getComputedStyle(e);return {className:e.className,href:e.getAttribute("href"),focusVisible:e.matches(":focus-visible"),outlineWidth:s.outlineWidth,left:Math.round(r.left),right:Math.round(r.right),viewport:document.documentElement.clientWidth}})()');
 if(!skipFocus.className?.includes("skip-link")||skipFocus.href!=="#contenido"||!skipFocus.focusVisible||parseFloat(skipFocus.outlineWidth)<2||skipFocus.left<0||skipFocus.right>skipFocus.viewport+2)
  report.failures.push("V5.4 keyboard skip-link focus not visible: "+JSON.stringify(skipFocus));
 report.tests.push({name:"V5.4 keyboard first-Tab skip-link",skipFocus});
 await capture("mobile-v54-keyboard-focus.png");

 await js('document.querySelector(".menu-button").focus()');
 await pressKey("Enter","Enter",13);
 const keyboardMenuOpen=await js('(()=>{const e=document.querySelector(".menu-button");return {expanded:e.getAttribute("aria-expanded"),focus:e===document.activeElement,focusVisible:e.matches(":focus-visible"),outlineWidth:getComputedStyle(e).outlineWidth}})()');
 if(keyboardMenuOpen.expanded!=="true"||!keyboardMenuOpen.focus||!keyboardMenuOpen.focusVisible||parseFloat(keyboardMenuOpen.outlineWidth)<2)
  report.failures.push("V5.4 keyboard Enter cannot access menu: "+JSON.stringify(keyboardMenuOpen));
 await pressKey("Escape","Escape",27);
 const keyboardMenuClosed=await js('(()=>{const e=document.querySelector(".menu-button");return {expanded:e.getAttribute("aria-expanded"),focused:e===document.activeElement}})()');
 if(keyboardMenuClosed.expanded!=="false"||!keyboardMenuClosed.focused)
  report.failures.push("V5.4 keyboard Escape does not restore menu focus: "+JSON.stringify(keyboardMenuClosed));
 report.tests.push({name:"V5.4 keyboard menu Enter and Escape",keyboardMenuOpen,keyboardMenuClosed});

 await js('document.querySelector("#ecosistema .prime-service-cta").focus()');
 const primeLinkKeyboard=await js('(()=>{const e=document.querySelector("#ecosistema .prime-service-cta");return {focused:e===document.activeElement,focusVisible:e.matches(":focus-visible"),href:e.getAttribute("href")}})()');
 if(!primeLinkKeyboard.focused||!primeLinkKeyboard.focusVisible||primeLinkKeyboard.href!=="./prime.html")report.failures.push("Prime model link keyboard access failed: "+JSON.stringify(primeLinkKeyboard));
 report.tests.push({name:"V5.4 keyboard Prime model link",primeLinkKeyboard});

 await call("Accessibility.enable");
 const tree=await call("Accessibility.getFullAXTree");
 const nodes=tree.result?.nodes||[];
 const headings=nodes.filter(n=>!n.ignored&&n.role?.value==="heading").map(n=>String(n.name?.value||"").trim());
 const accessible={nodeCount:nodes.length,headingCount:headings.length,
   hasHero:nodes.some(n=>!n.ignored&&n.role?.value==="heading"&&n.properties?.some(p=>p.name==="level"&&p.value?.value===1)&&/^Tu tiempo\s+vale más$/i.test(String(n.name?.value||"").trim().replace(/\s+/g," "))),hasContact:headings.some(n=>n.includes("CONEXIONES"))};
 if(!accessible.hasHero||!accessible.hasContact||accessible.headingCount<6)
  report.failures.push("V5.4 accessibility tree missing landmarks or headlines: "+JSON.stringify(accessible));
 report.tests.push({name:"V5.4 Chromium accessibility tree structural smoke",accessible});
 // Verify the exact deployable package as well as the working source, on all three device classes.
 const packaged=pathToFileURL(resolve("dist/index.html")).href;
 for(const [w,h] of [[1440,900],[768,900],[430,932],[390,844],[360,800],[320,700]]){
  const result=await viewport(w,h,false,packaged);
  await verifySharedNavigation("dist/","index",w);
  const source=report.viewports.find(v=>v.source==="source"&&v.width===w&&!v.reduce);
  const fingerprint=x=>JSON.stringify({surface:x.surface,gap:x.gap,columns:x.columns,revision:x.revision,cards:x.cards.map(c=>({brand:c.brand,background:c.background,borderColor:c.borderColor,borderWidth:c.borderWidth,radius:c.radius,divider:c.divider,primeColor:c.primeColor,centered:c.centered,descriptionColor:c.descriptionColor,cta:c.cta}))});
  if(!source||fingerprint(source.servicesLayout)!==fingerprint(result.servicesLayout))report.failures.push("Packaged and source service presentation differ at "+w);
  await js('document.querySelector("#soluciones").scrollIntoView({block:"center",behavior:"instant"})');
  await sleep(700);
  await capture("dist-services-"+w+"px.png");
  report.tests.push({name:"Source/dist service visual parity "+w,services:result.servicesLayout});
   if(!source||JSON.stringify(source.partnerLayout)!==JSON.stringify(result.partnerLayout))report.failures.push("Packaged and source partner presentation differ at "+w);
   await js('document.querySelector("#negocios").scrollIntoView({block:"center",behavior:"instant"})');
   await sleep(1000);
   await capture("dist-partners-"+w+"px.png");
   report.tests.push({name:"Source/dist partner visual parity "+w,partners:result.partnerLayout});
 }

 // WEB-CLOSE-02: test real shared navigation on every institutional viewport.
 async function verifySharedNavigation(root,page,w){
  const state=await js(`(()=>{const n=document.querySelector(".main-nav"),b=document.querySelector(".menu-button"),f=document.querySelector(".corporate-footer"),v=document.documentElement.clientWidth;if(!n||!b||!f)return null;const brand=document.querySelector(".site-header .brand"),name=brand?.querySelector(".brand-name"),mark=brand?.querySelector(".brand-mark");if(!brand||!name||!mark)return null;const br=Math.max(brand.getBoundingClientRect().right,name.getBoundingClientRect().right,mark.getBoundingClientRect().right),navVisible=getComputedStyle(n).display!=="none",other=navVisible?n.querySelector("a:not(.nav-submenu a)"):b,links=[...n.querySelectorAll("a:not(.nav-submenu a)")];return {geometry:br<=other.getBoundingClientRect().left+1&&(!navVisible||links.every((a,i)=>a.getBoundingClientRect().right<=v+2&&(!i||links[i-1].getBoundingClientRect().right<=a.getBoundingClientRect().left+1))),ready:document.documentElement.classList.contains("js-enabled"),nav:getComputedStyle(n).display,button:getComputedStyle(b).display,expanded:b.getAttribute("aria-expanded"),links:n.querySelectorAll("a:not(.nav-submenu a)").length,footer:f.querySelectorAll("a").length,inside:[...f.querySelectorAll("a")].every(a=>a.getBoundingClientRect().left>=0&&a.getBoundingClientRect().right<=v+2),overflow:document.documentElement.scrollWidth>v+2}})()`);
  const label=root+page+" "+w;
  if(!state||!state.ready||state.links!==7||state.footer!==14||!state.inside||!state.geometry||state.overflow||state.expanded!=="false"){report.failures.push("WEB-CLOSE-02 initial "+label+": "+JSON.stringify(state));return;}
  if(w<=960){
   if(state.nav!=="none"||state.button==="none")report.failures.push("WEB-CLOSE-02 mobile initial "+label);
   const result=await js(`(()=>{const n=document.querySelector(".main-nav"),b=document.querySelector(".menu-button"),v=document.documentElement.clientWidth;b.click();const open=b.getAttribute("aria-expanded")==="true"&&getComputedStyle(n).display!=="none"&&[...n.querySelectorAll("a:not(.nav-submenu a)")].every(a=>a.getBoundingClientRect().left>=0&&a.getBoundingClientRect().right<=v+2&&a.getBoundingClientRect().height>=44);return open})()`);
   if(!result)report.failures.push("WEB-CLOSE-02 open menu "+label);
   if(w===390||w===768)await capture((root?"dist-":"source-")+page+"-shared-menu-"+w+"px.png");
   const closed=await js(`(()=>{const b=document.querySelector(".menu-button"),n=document.querySelector(".main-nav");document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));const close=b.getAttribute("aria-expanded")==="false"&&getComputedStyle(n).display==="none"&&document.activeElement===b;document.documentElement.classList.remove("js-enabled");const fallback=getComputedStyle(n).display!=="none"&&[...n.querySelectorAll("a:not(.nav-submenu a)")].every(a=>a.getBoundingClientRect().height>=44);document.documentElement.classList.add("js-enabled");b.blur();return {close,fallback}})()`);
   if(!closed.close||!closed.fallback)report.failures.push("WEB-CLOSE-02 Escape/fallback "+label+": "+JSON.stringify(closed));
  }else if(state.nav==="none"||state.button!=="none")report.failures.push("WEB-CLOSE-02 desktop navigation "+label);
  // Preserve parent navigation checks and exercise both disclosures.
  const disclosure=await js(`(()=>{const n=document.querySelector(".main-nav"),b=document.querySelector(".menu-button"),groups=[...n.querySelectorAll(".nav-expand")],v=document.documentElement.clientWidth;if(groups.length!==2)return {ok:false};const mobile=getComputedStyle(b).display!=="none";if(mobile)b.click();const [first,second]=groups;first.click();const p=document.getElementById(first.getAttribute("aria-controls"));const open=first.getAttribute("aria-expanded")==="true"&&!p.hidden&&[...p.querySelectorAll("a")].every(a=>a.getBoundingClientRect().height>=44&&a.getBoundingClientRect().right<=v+2);second.click();const exclusive=p.hidden&&second.getAttribute("aria-expanded")==="true";document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true}));const closed=second.getAttribute("aria-expanded")==="false"&&document.activeElement===second;if(mobile)b.click();return {ok:open&&exclusive&&closed,open,exclusive,closed}})()`);
  if(!disclosure.ok)report.failures.push("CORPORATE-HOME-01 disclosure "+label+": "+JSON.stringify(disclosure));
  if(page==="index"){
   await js('document.querySelector("#empresa-destacada").scrollIntoView({block:"start",behavior:"instant"})');
   await sleep(150);
   const hierarchy=await js(`(()=>{const grid=document.querySelector("#empresa-destacada .institutional-home-grid"),cards=[...grid.querySelectorAll("article")],strip=document.querySelector("#inicio .v4-hero-rail"),sections=[...document.querySelectorAll("main>section")];return {order:sections.map(e=>e.id).join("|"),recent:strip.parentElement?.id==="inicio"&&strip.parentElement.nextElementSibling?.id==="soluciones"&&sections.at(-1)?.id==="empresa-destacada"&&!document.querySelector(".institutional-recent"),columns:getComputedStyle(grid).gridTemplateColumns.trim().split(/\\s+/).length,headings:cards.map(e=>e.querySelector("h3").textContent),fit:cards.every(e=>e.scrollWidth<=e.clientWidth+2&&e.getBoundingClientRect().width>0),investors:cards[1]?.querySelector('a[href="./empresa.html#inversores"]')?.getBoundingClientRect().height>=44}})()`);
   if(hierarchy.order!=="inicio|soluciones|vision|talento-destacado|negocios|empresa-destacada"||!hierarchy.recent||hierarchy.columns!==(w<=700?1:3)||hierarchy.headings.join("|")!=="Empresa|Inversores|Noticias"||!hierarchy.fit||!hierarchy.investors)report.failures.push("VISUAL-HIERARCHY-01 "+label+": "+JSON.stringify(hierarchy));
   if(w===1440||w===390)await capture((root?"dist-":"source-")+"hierarchy-"+w+"px.png");
   report.tests.push({name:"VISUAL-HIERARCHY-01 "+label,hierarchy});
   await js('document.querySelector("#talento-destacado").scrollIntoView({block:"center",behavior:"instant"})');
   await until(async()=>await js('(()=>{const x=document.querySelector(".talent-photo img");return x?.complete&&x.naturalWidth===1200&&x.naturalHeight===900})()'),"Talent photograph loaded");
   const talent=await js(`(()=>{const t=document.querySelector("#talento-destacado"),h=t.querySelector("h2").getBoundingClientRect(),i=t.querySelector("img"),f=i.getBoundingClientRect(),a=t.querySelector("a").getBoundingClientRect(),s=getComputedStyle(i);return {ratio:f.width/f.height,fit:s.objectFit,position:s.objectPosition,loaded:i.complete&&i.naturalWidth===1200,loading:i.loading,inside:f.left>=0&&f.right<=document.documentElement.clientWidth+2,desktop:f.left>=h.right-2,mobile:h.bottom<=f.top+2&&f.bottom<=a.top+2,tap:a.height,source:i.getAttribute("src"),caption:!!t.querySelector("figcaption"),alt:i.alt}})()`);
   if(!talent.loaded||talent.loading!=="lazy"||!talent.inside||talent.fit!=="cover"||talent.tap<44||Math.abs(talent.ratio-(w<=700?1.6:4/3))>.04||(w<=700?!talent.mobile:!talent.desktop)||talent.caption||talent.source!=="./assets/talento-equipo.webp"||talent.position!=="50% 50%"||!talent.alt)report.failures.push("PHOTO-01 "+label+": "+JSON.stringify(talent));
   if(w===1440||w===390)await capture((root?"dist-":"source-")+"talent-"+w+"px.png");
   report.tests.push({name:"PHOTO-01 "+label,talent});
  }
  report.tests.push({name:"WEB-CLOSE-02 shared navigation "+label,state,disclosure});
 }

 // Validate the new company page in both source and packaged form.
 for(const root of ["","dist/"]){
  for(const [w,h] of [[1440,900],[768,900],[390,844],[320,700]]){
   await call("Emulation.setDeviceMetricsOverride",{width:w,height:h,deviceScaleFactor:1,mobile:w<=800});
   await call("Page.navigate",{url:pathToFileURL(resolve(root+"empresa.html")).href});
   await until(async()=>await js("document.readyState==='complete' && !!document.querySelector('.company-page')"),"company page render");
   await js('document.fonts.ready');
   await verifySharedNavigation(root,"empresa",w);
   const company=await js(`(()=>{const v=document.documentElement.clientWidth,n=document.querySelector(".corporate-footer");return {title:document.querySelector("h1").textContent,sections:[...document.querySelectorAll("main section")].map(e=>e.id),width:v,scroll:document.documentElement.scrollWidth,columns:getComputedStyle(n).gridTemplateColumns.trim().split(/\\s+/).length,links:[...n.querySelectorAll("a:not(.nav-submenu a)")].map(e=>({href:e.getAttribute("href"),inside:e.getBoundingClientRect().left>=0&&e.getBoundingClientRect().right<=v+2})),home:document.querySelector("header .brand").getAttribute("href"),robots:document.querySelector('meta[name="robots"]').content}})()`);
   if(company.title!=="Empresa"||company.sections.join("|")!=="mensaje-direccion|quienes-somos|mision-vision|principios-actuacion|gobierno-responsabilidad|historia|inversores"||company.scroll>company.width+2||company.columns!==2||company.links.length!==14||!company.links.some(x=>x.href==="./aplicaciones.html")||company.links.some(x=>!x.inside)||company.home!=="./index.html"||company.robots!=="noindex,nofollow")report.failures.push("Company page "+root+w+": "+JSON.stringify(company));
   await js('window.scrollTo({top:0,behavior:"instant"})');
   await until(async()=>await js('[...document.querySelectorAll(".co-photo img")].length===3&&[...document.querySelectorAll(".co-photo img")].every(i=>i.complete&&i.naturalWidth>0&&i.loading==="eager")'),"company directory photos loaded");
   await js('Promise.all([...document.querySelectorAll(".co-photo img")].map(i=>i.decode())).then(()=>true)');
   for(const id of ["quienes-somos","mision-vision","principios-actuacion"]){
    await js('document.querySelector("#'+id+' .co-photo").scrollIntoView({block:"center",behavior:"instant"})');
    await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))');
    const photo=await js(`(()=>{const i=document.querySelector("#${id} .co-photo img"),r=i.getBoundingClientRect(),s=getComputedStyle(i);return {loaded:i.complete&&i.naturalWidth>0&&i.naturalHeight>0,visible:r.top>=0&&r.bottom<=innerHeight+2&&r.width>0&&r.left>=0&&r.right<=innerWidth+2&&s.visibility==="visible"&&s.display!=="none"&&Number(s.opacity)>0}})()`);
    if(!photo.loaded||!photo.visible)report.failures.push("COMPANY-02 viewport photo "+root+id+w+": "+JSON.stringify(photo));
    await capture((root?"dist-":"source-")+"company-photo-"+id+"-"+w+"px.png");
   }
   await js('window.scrollTo({top:0,behavior:"instant"})');
   await js('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))');
   await capture((root?"dist-":"source-")+"company-"+w+"px.png",true);
   const hub=await js(`(()=>{const g=document.querySelector(".co-directory"),cards=[...g.querySelectorAll(".co-card")];return {links:cards.map(c=>c.querySelector("a").getAttribute("href")),columns:getComputedStyle(g).gridTemplateColumns.trim().split(/\\s+/).length,fit:cards.every(c=>c.scrollWidth<=c.clientWidth+2&&c.getBoundingClientRect().width>0)}})()`);
   if(hub.links.join("|")!==companyRoutes.map(x=>"./"+x+".html").join("|")||hub.columns!==(w<=700?1:2)||!hub.fit)report.failures.push("COMPANY-02 directory "+root+w+": "+JSON.stringify(hub));
   for(const page of companyRoutes){
    await call("Page.navigate",{url:pathToFileURL(resolve(root+page+".html")).href});
    await until(async()=>await js("document.readyState==='complete' && !!document.querySelector('.company-detail')"),"company detail render");
    await js("document.fonts.ready");
    const detail=await js(`(()=>{const v=document.documentElement.clientWidth,m=document.querySelector(".company-detail");return {title:m.querySelector("h1").textContent,duplicate:[...m.querySelectorAll("h2")].some(h=>h.textContent.trim().replace(/[.]$/,"")===m.querySelector("h1").textContent.trim()),fit:document.documentElement.scrollWidth<=v+2&&[...m.querySelectorAll("h1,h2,h3,p,li")].every(e=>e.scrollWidth<=e.clientWidth+2),back:m.querySelector(".co-back").getAttribute("href"),robots:document.querySelector('meta[name="robots"]').content,forms:m.querySelectorAll("form,input,iframe").length}})()`);
    if(detail.title!==companyTitles[page]||detail.duplicate||!detail.fit||detail.back!=="./empresa.html"||detail.robots!=="noindex,nofollow"||detail.forms)report.failures.push("COMPANY-02 detail "+root+page+w+": "+JSON.stringify(detail));
    if(w===1440||w===390){await verifySharedNavigation(root,page,w);await js('window.scrollTo({top:0,behavior:"instant"})');await capture((root?"dist-":"source-")+page+"-"+w+"px.png",true);}
    if(page==="perfil-corporativo"){
     const profile=await js(`(()=>{const m=document.querySelector("main"),v=document.documentElement.clientWidth;return {sections:[...m.querySelectorAll(".co-profile section")].map(x=>x.id),rows:m.querySelectorAll(".cp-facts tr").length,headers:m.querySelectorAll('.cp-facts th[scope="row"]').length,identity:m.querySelector(".cp-facts td").textContent,businesses:[...m.querySelectorAll(".cp-business")].map(e=>e.querySelectorAll("li").length),links:[...m.querySelectorAll(".cp-directory a")].map(x=>x.getAttribute("href")),media:m.querySelectorAll("img,video,figure").length,controls:[...m.querySelectorAll(".cp-business a,.cp-directory a,.co-back")].every(e=>e.getBoundingClientRect().height>=44),overflow:[...m.querySelectorAll("th,td,h2,h3,p,li")].filter(e=>e.getBoundingClientRect().width<=0||e.scrollWidth>e.clientWidth+2||e.getBoundingClientRect().right>v+2).map(e=>({tag:e.tagName,text:e.textContent.slice(0,80)}))}})()`);
     if(profile.sections.join("|")!=="quienes-somos|informacion-corporativa|areas|informacion-empresa"||profile.rows!==8||profile.headers!==8||profile.identity!=="DELIVER ASSETS E.I.R.L."||profile.businesses.join("|")!=="5|5"||profile.links.join("|")!=="./mensaje-direccion.html|./mision-vision-valores.html|./principios.html|./gobierno-corporativo.html|./historia.html|./inversores.html|./confianza.html"||profile.media||!profile.controls||profile.overflow.length)report.failures.push("COMPANY-PROFILE-01 "+root+w+": "+JSON.stringify(profile));
     report.tests.push({name:"COMPANY-PROFILE-01 four approved sections "+root+w,profile});
     await capture((root?"dist-":"source-")+"perfil-corporativo-completo-"+w+"px.png",true);
    }
    report.tests.push({name:"COMPANY-02 detail "+root+page+w,detail});
   }
   await call("Page.navigate",{url:pathToFileURL(resolve(root+"mensaje-direccion.html")).href});
   await until(async()=>await js("document.readyState==='complete' && !!document.querySelector('#mensaje-direccion')"),"message detail");
   const message=await js(`(()=>{const e=document.querySelector("#mensaje-direccion");return {title:e.querySelector("h2").textContent,paragraphs:e.querySelectorAll("p").length,fit:e.scrollWidth<=e.clientWidth+2,visible:e.getBoundingClientRect().height>0}})()`);
   if(message.title!=="Crecer con criterio. Construir para permanecer."||message.paragraphs!==3||!message.fit||!message.visible)report.failures.push("MESSAGE-01 "+root+w+": "+JSON.stringify(message));
   await call("Page.navigate",{url:pathToFileURL(resolve(root+"historia.html")).href});
   await until(async()=>await js("document.readyState==='complete' && !!document.querySelector('#historia')"),"history detail");
   const history=await js(`(()=>{const e=document.querySelector("#historia"),items=[...e.querySelectorAll(".history-timeline li")];return {year:e.querySelector(".history-year").textContent,items:items.map(n=>n.querySelector("h4").textContent),fit:items.every(n=>n.getBoundingClientRect().left>=0&&n.getBoundingClientRect().right<=document.documentElement.clientWidth+2),ordered:items.every((n,i)=>!i||n.getBoundingClientRect().top>=items[i-1].getBoundingClientRect().bottom-1)}})()`);
   if(history.year!=="2026"||history.items.join("|")!=="Identidad institucional|DESSET prime|Infraestructura corporativa"||!history.fit||!history.ordered)report.failures.push("HISTORY-01 "+root+w+": "+JSON.stringify(history));
   await js('document.querySelector("#historia").scrollIntoView({block:"start",behavior:"instant"})');
   await capture((root?"dist-":"source-")+"historia-cronologia-"+w+"px.png",false);
   await js('document.querySelector(".site-footer").scrollIntoView({block:"end",behavior:"instant"})');
   await capture((root?"dist-":"source-")+"footer-"+w+"px.png");
   report.tests.push({name:"Company page "+root+w,company});
  }
 }

 // Audience pages must be responsive and available in source and dist.
 for(const page of ["comercios","repartidores"]){
 for(const root of ["","dist/"]){
  for(const [w,h] of (page==="repartidores"?[[1440,900],[1028,900],[768,900],[390,844],[351,780],[320,700]]:[[1440,900],[768,900],[390,844],[320,700]])){
   await call("Emulation.setDeviceMetricsOverride",{width:w,height:h,deviceScaleFactor:1,mobile:w<=800});
   await call("Page.navigate",{url:pathToFileURL(resolve(root+page+".html")).href});
   await until(async()=>await js("document.readyState==='complete' && !!document.querySelector('.audience-page')"),"audience page render");
   await js('document.fonts.ready');
   await verifySharedNavigation(root,page,w);
   const merchant=await js(`(()=>{const v=document.documentElement.clientWidth;return {title:document.querySelector("h1").textContent,sections:[...document.querySelectorAll("main section")].map(e=>e.id),width:v,scroll:document.documentElement.scrollWidth,home:document.querySelector("header .brand").getAttribute("href"),robots:document.querySelector('meta[name="robots"]').content,forms:document.querySelectorAll("form,input,iframe").length,channelLinks:document.querySelectorAll("#canales-oficiales a").length,cta:document.querySelector("#incorporacion a").getAttribute("href"),overflow:[...document.querySelectorAll("main h1,main h2,main p,main li")].filter(e=>!e.closest("details:not([open])")&&(e.getBoundingClientRect().width<=0||e.scrollWidth>e.clientWidth+2)).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent.slice(0,90),client:e.clientWidth,scroll:e.scrollWidth})),visible:[...document.querySelectorAll("main h1,main h2,main p,main li")].every(e=>(e.closest("details:not([open])")||e.getBoundingClientRect().width>0&&e.scrollWidth<=e.clientWidth+2))}})()`);
   if(merchant.title!==(page==="comercios"?"TU NEGOCIO, MÁS ALLÁ DE SUS PUERTAS":"CADA ENTREGA CONECTA UNA HISTORIA")||merchant.sections.join("|")!==(page==="comercios"?"presentacion|beneficios|categorias|modelo|condiciones|aplicacion|incorporacion|preguntas|cierre-comercial":"presentacion|beneficios|vehiculos|modelo|requisitos|condiciones|aplicacion|academia|incorporacion|preguntas|cierre-comercial")||merchant.scroll>merchant.width+2||merchant.home!=="./index.html"||merchant.robots!=="noindex,nofollow"||merchant.forms||merchant.channelLinks!==5||merchant.cta!==(page==="comercios"?"./incorporacion-comercios.html":"./incorporacion-repartidores.html")||!merchant.visible)report.failures.push("MERCHANT-01 "+root+w+": "+JSON.stringify(merchant));
   const photo=await js(`(()=>{const t=document.querySelector(".ap-hero"),i=t.querySelector("img"),f=t.querySelector("figure"),c=t.querySelector(".ap-hero-copy"),r=t.getBoundingClientRect(),p=f.getBoundingClientRect(),a=[...c.querySelectorAll(".ap-button")].map(e=>({href:e.getAttribute("href"),height:e.getBoundingClientRect().height,inside:e.getBoundingClientRect().left>=r.left&&e.getBoundingClientRect().right<=r.right+2}));return {mode:t.classList.contains("ap-hero--merchant-photo"),source:i.getAttribute("src"),loaded:i.complete&&i.naturalWidth>0,full:Math.abs(r.width-p.width)<2&&Math.abs(r.height-p.height)<2,background:getComputedStyle(t).backgroundColor,fit:getComputedStyle(i).objectFit,overlay:getComputedStyle(f,"::after").backgroundImage,caption:!!f.querySelector("figcaption"),alt:i.alt,extraCopy:c.querySelectorAll("p").length,flowNumbers:document.querySelectorAll("#modelo .ap-step strong").length,flowNote:!!document.querySelector("#modelo .ap-note"),flowBorders:[...document.querySelectorAll("#modelo .ap-step")].map(e=>getComputedStyle(e).borderTopWidth),buttons:a}})()`);
   if(page==="comercios"?(!photo.mode||photo.source!=="./assets/comercios-hero-minimercado.webp"||!photo.loaded||!photo.full||photo.background!=="rgb(24, 24, 24)"||photo.fit!=="cover"||!photo.overlay.includes("linear-gradient")||photo.caption||!photo.alt.startsWith("Fotografía referencial")||photo.extraCopy!==0||photo.flowNumbers!==0||photo.flowNote||photo.flowBorders.length!==4||photo.flowBorders.some(x=>x!=="0px")||photo.buttons.length!==2||photo.buttons[0].href!=="./incorporacion-comercios.html"||photo.buttons[1].href!=="#modelo"||photo.buttons.some(a=>a.height<44||!a.inside)):photo.mode)report.failures.push("PHOTO-02 "+root+page+w+": "+JSON.stringify(photo));
   report.tests.push({name:"PHOTO-02 "+root+page+w,photo});
   if(page==="repartidores"){
    const rider=await js(`(()=>{const t=document.querySelector(".ap-hero"),c=t.querySelector(".ap-hero-copy"),i=t.querySelector("img"),h=c.querySelector("h1"),r=t.getBoundingClientRect(),b=c.getBoundingClientRect();return {mode:t.classList.contains("ap-hero--rider-photo"),loaded:i.complete&&i.naturalWidth===1024&&i.naturalHeight===1280,source:i.getAttribute("src"),full:Math.abs(t.querySelector("figure").getBoundingClientRect().height-r.height)<2,ink:getComputedStyle(h).color,background:getComputedStyle(t).backgroundColor,overlay:getComputedStyle(t,"::after").backgroundImage,lines:[...h.querySelectorAll("span")].map(e=>e.textContent),padding:parseFloat(getComputedStyle(c).paddingBottom),inside:b.top>=r.top-2&&b.bottom<=r.bottom+2,caption:!!t.querySelector("figcaption"),extra:c.querySelectorAll("p").length}})()`);
    if(!rider.mode||!rider.loaded||rider.source!=="./assets/repartidores-hero-original.jpg"||!rider.full||rider.ink!=="rgb(255, 255, 255)"||rider.background!=="rgb(0, 0, 0)"||rider.lines.join("|")!=="CADA ENTREGA|CONECTA UNA|HISTORIA"||!rider.inside||rider.caption||rider.extra||photo.buttons.length!==1||photo.buttons[0].href!=="#modelo"||photo.buttons[0].height<44||!photo.buttons[0].inside||(w<=780&&(!rider.overlay.includes("linear-gradient")||rider.padding<48)))report.failures.push("PHOTO-06 "+root+w+": "+JSON.stringify(rider));
    report.tests.push({name:"PHOTO-06 approved rider portrait "+root+w,rider});
   }
   await capture((root?"dist-":"source-")+page+"-"+w+"px.png",true);
   if(page==="comercios"){
    const commercial=await js(`(()=>{const m=document.querySelector("main");return {categories:m.querySelectorAll(".mc-categories li").length,terms:m.querySelectorAll(".mc-terms dt").length,status:[...m.querySelectorAll(".mc-terms dd")].every(x=>x.textContent==="Pendiente de aprobación"),app:m.querySelector("#aplicacion a").getAttribute("href"),features:m.querySelectorAll(".mc-app li").length,steps:m.querySelectorAll(".mc-journey li").length,faqs:m.querySelectorAll("#preguntas details").length,closing:m.querySelector("#cierre-comercial a").getAttribute("href"),images:m.querySelectorAll("img,video").length,controls:[...m.querySelectorAll("a.ap-button,summary")].every(x=>x.getBoundingClientRect().height>=44)}})()`);
    if(commercial.categories!==6||commercial.terms!==4||!commercial.status||commercial.app!=="./aplicaciones-comercios.html"||commercial.features!==4||commercial.steps!==7||commercial.faqs!==6||commercial.closing!=="./incorporacion-comercios.html"||commercial.images!==1||!commercial.controls)report.failures.push("COMERCIOS-02 "+root+w+": "+JSON.stringify(commercial));
    report.tests.push({name:"COMERCIOS-02 nine approved sections "+root+w,commercial});
    await capture("comercios-completo-"+(root.includes("dist")?"dist":"source")+"-"+w+".png",true);
   }
   if(page==="repartidores"){
    const rd=await js(`(()=>{const m=document.querySelector("main");return {vehicles:m.querySelectorAll(".mc-categories li").length,requirements:m.querySelectorAll(".rd-requirements li").length,terms:m.querySelectorAll(".mc-terms dt").length,status:[...m.querySelectorAll(".mc-terms dd")].every(x=>x.textContent==="Pendiente de aprobación"),app:m.querySelector("#aplicacion a").getAttribute("href"),features:m.querySelectorAll("#aplicacion .mc-app li").length,academy:m.querySelector("#academia a").getAttribute("href"),topics:m.querySelectorAll("#academia li").length,steps:m.querySelectorAll(".mc-journey li").length,faqs:m.querySelectorAll("#preguntas details").length,closing:m.querySelector("#cierre-comercial a").getAttribute("href"),images:m.querySelectorAll("img,video").length,controls:[...m.querySelectorAll("a.ap-button,summary")].every(x=>x.getBoundingClientRect().height>=44)}})()`);
    if(rd.vehicles!==3||rd.requirements!==6||rd.terms!==4||!rd.status||rd.app!=="./aplicaciones-repartidores.html"||rd.features!==4||rd.academy!=="./capacitacion-repartidores.html"||rd.topics!==5||rd.steps!==7||rd.faqs!==6||rd.closing!=="./incorporacion-repartidores.html"||rd.images!==1||!rd.controls)report.failures.push("REPARTIDORES-02 "+root+w+": "+JSON.stringify(rd));
    report.tests.push({name:"REPARTIDORES-02 eleven approved sections "+root+w,rd});
    await capture("repartidores-completo-"+(root.includes("dist")?"dist":"source")+"-"+w+".png",true);
   }
   report.tests.push({name:"Audience page "+page+" "+root+w,merchant});
  }
 }
 }
 // PRIME-01: verify the institutional logistics route in source and exact package.
 for(const root of ["","dist/"]){
  for(const [w,h] of [[1440,900],[768,900],[390,844],[320,700]]){
   await call("Emulation.setDeviceMetricsOverride",{width:w,height:h,deviceScaleFactor:1,mobile:w<=800});
   await call("Emulation.setEmulatedMedia",{media:"screen",features:[{name:"prefers-reduced-motion",value:"no-preference"}]});
   await call("Page.navigate",{url:pathToFileURL(resolve(root+"prime.html")).href});
   await until(async()=>await js("document.readyState==='complete' && !!document.querySelector('.prime-page')"),"prime page render");
   await js('document.fonts.ready');
   // Exercise native lazy loading by visiting each approved photograph; do not alter production attributes.
   const photoCount=await js('document.querySelectorAll("main img").length');
   if(photoCount!==6)report.failures.push("PRIME-01 photo inventory "+root+w+": "+photoCount);
   for(let i=0;i<photoCount;i++){
    await js('document.querySelectorAll("main img")['+i+'].scrollIntoView({block:"center",behavior:"instant"})');
    await until(async()=>await js('(()=>{const e=document.querySelectorAll("main img")['+i+'];return e.complete&&e.naturalWidth>0})()'),"Prime photo "+i+" "+root+w);
   }
   await js('window.scrollTo({top:0,behavior:"instant"})');
   const brand=await js('(()=>{const a=document.querySelector(".site-header .prime-header-brand"),n=a?.querySelector(".brand-name"),p=n?.querySelector(".pr-wordmark");if(!a||!n||!p)return null;const x=getComputedStyle(n),y=getComputedStyle(p),r=a.getBoundingClientRect(),home=document.querySelector(".site-header > a:last-child").getBoundingClientRect();return {label:n.textContent,icon:!!a.querySelector("img,svg"),blue:x.color,primeBlue:y.color,bold:x.fontWeight,light:y.fontWeight,style:y.fontStyle,sameSize:x.fontSize===y.fontSize,fit:r.width>0&&r.left>=0&&r.right<=home.left+2}})()');
   if(!brand||brand.label!=="DESSET Prime"||brand.icon||brand.blue!=="rgb(7, 59, 188)"||brand.primeBlue!==brand.blue||brand.bold!=="800"||brand.light!=="500"||brand.style!=="normal"||!brand.sameSize||!brand.fit)report.failures.push("PRIME brand "+root+w+": "+JSON.stringify(brand));
   const prime=await js(`(()=>{const v=document.documentElement.clientWidth;return {title:document.querySelector("h1").textContent,lead:document.querySelector(".pr-hero .pr-lead").textContent,headingCount:document.querySelectorAll("h1").length,headingFit:[...document.querySelectorAll("#prime-title span")].every(e=>e.clientWidth>0&&e.scrollWidth<=e.clientWidth+2&&getComputedStyle(e).display==="block"),sections:[...document.querySelectorAll("main section")].length,cards:document.querySelectorAll(".pr-card").length,steps:document.querySelectorAll(".pr-steps li").length,width:v,scroll:document.documentElement.scrollWidth,background:getComputedStyle(document.querySelector(".pr-hero")).backgroundColor,visionBackground:getComputedStyle(document.querySelector(".pr-vision")).backgroundColor,forms:document.querySelectorAll("form,input,iframe").length,links:document.querySelectorAll("#canales-oficiales a").length,cta:document.querySelector(".pr-button").getAttribute("href"),images:[...document.querySelectorAll("main img")].every(e=>e.complete&&e.naturalWidth>0),visible:[...document.querySelectorAll("main h1,main h2,main h3,main p,main li")].filter(e=>!e.closest(".v5-city-stage")).every(e=>e.clientWidth>0&&e.scrollWidth<=e.clientWidth+2)}})()`);
   if(prime.title!=="DEL ORIGEN AL DESTINO MÁS ALLÁ DE LAS DISTANCIAS"||prime.lead!=="Creemos que la distancia no debe ser una barrera para el comercio, las empresas ni las personas. Nuestro propósito es conectar cada origen con su destino, independientemente de lo lejos que esté."||prime.headingCount!==1||!prime.headingFit||prime.sections!==5||prime.cards!==4||prime.steps!==4||prime.scroll>prime.width+2||prime.background!=="rgb(0, 0, 0)"||prime.visionBackground!=="rgb(0, 0, 0)"||prime.forms||prime.links!==5||prime.cta!=="#modelo"||!prime.images||!prime.visible)report.failures.push("PRIME-01 "+root+w+": "+JSON.stringify(prime));
   await capture((root?"dist-":"source-")+"prime-"+w+"px.png",true);
   await js('document.querySelector("#modelo .v5-city-stage").scrollIntoView({block:"center",behavior:"instant"})');
   await sleep(580);
   const v5Stage=await js('(()=>{const measureFallback=()=>{const e=document.querySelector("#modelo .v5-city-stage"),t=e?.querySelector(".v6-static-fallback"),world=e?.querySelector(".v5-stage-world");if(!t||!world)return {readable:false,missing:true};const b=world.getBoundingClientRect(),cs=getComputedStyle(t),lines=[...t.querySelectorAll("span,strong,p")].map(n=>{const range=document.createRange();range.selectNodeContents(n);const rects=[...range.getClientRects()].filter(r=>r.width>0&&r.height>0);return {className:n.className,text:n.textContent,rects:rects.map(r=>({left:r.left-b.left,right:r.right-b.left,top:r.top-b.top,bottom:r.bottom-b.top})),inside:rects.length>0&&rects.every(r=>r.left>=b.left-2&&r.right<=b.right+2&&r.top>=b.top-2&&r.bottom<=b.bottom+2)}});return {state:e.dataset.v6State||"initial",visibility:cs.visibility,opacity:Number(cs.opacity),display:cs.display,readable:cs.visibility==="visible"&&cs.display!=="none"&&Number(cs.opacity)>.99&&lines.length===3&&lines.every(n=>n.inside),lines}};const e=document.querySelector("#modelo .v5-city-stage"),t=e?.querySelector(".v6-static-fallback"),r=e?.getBoundingClientRect(),world=e?.querySelector(".v5-stage-world")?.getBoundingClientRect(),v=document.documentElement.clientWidth;return {count:document.querySelectorAll(".v5-city-stage").length,visible:e?.classList.contains("v5-visible"),fallback:!!t,fallbackMeasurement:measureFallback(),active:e?.dataset.v6State==="active",sourceImage:!!e?.querySelector("img,picture,.v5-responsive-art,.v5-stage-render,.v5-stage-scan"),fallbackText:t?.textContent.includes("CENTRO")&&t?.textContent.includes("simulaciones"),worldWidth:world?.width,worldHeight:world?.height,ratio:world?.height/world?.width,left:r?.left,right:r?.right,viewport:v,sceneDescription:e?.getAttribute("aria-label"),noCaption:!e?.querySelector("figcaption,.v5-stage-caption"),noBridge:!document.querySelector(".motion-story-bridge"),radius:parseFloat(getComputedStyle(e).borderTopLeftRadius),stageFrame:getComputedStyle(e).backgroundColor,stageToolbar:getComputedStyle(e.querySelector(".v6-three-toolbar")).backgroundColor,threeTourButton:getComputedStyle(e.querySelector(".v63-tour")).backgroundColor,threePauseButton:getComputedStyle(e.querySelector(".v6-pause")).backgroundColor,afterSteps:!!document.querySelector("#modelo .pr-steps + .pr-logistics-stage")}})()');
   if(v5Stage.count!==1||!v5Stage.visible||!v5Stage.fallback||(!v5Stage.active&&!v5Stage.fallbackMeasurement.readable)||v5Stage.sourceImage||!v5Stage.fallbackText||v5Stage.worldWidth<200||v5Stage.worldHeight<200||v5Stage.left< -2||v5Stage.right>v5Stage.viewport+2||!v5Stage.sceneDescription?.includes("conceptual")||!v5Stage.noCaption||!v5Stage.noBridge||!v5Stage.afterSteps||v5Stage.radius<15||(w<=390&&v5Stage.ratio<1.4)||v5Stage.stageFrame!=="rgb(244, 248, 254)"||v5Stage.stageToolbar!=="rgb(244, 248, 254)"||v5Stage.threeTourButton!=="rgb(255, 255, 255)"||v5Stage.threePauseButton!=="rgb(255, 255, 255)")report.failures.push("Prime relocated scene "+root+w+": "+JSON.stringify(v5Stage));
   report.tests.push({name:"V5 accessible image-free desktop stage / Prime responsive "+root+w,v5Stage});
   await capture((root?"dist-":"source-")+"prime-3d-"+w+"px.png");
   {
    await call("Emulation.setEmulatedMedia",{media:"screen",features:[{name:"prefers-reduced-motion",value:"reduce"}]});
    await call("Page.navigate",{url:pathToFileURL(resolve(root+"prime.html")).href});
    await until(async()=>await js("document.readyState==='complete' && !!document.querySelector('.prime-page')"),"reduced Prime render");
    await js('document.fonts.ready');
    const v5Reduced=await js('(()=>{const measureFallback=()=>{const e=document.querySelector("#modelo .v5-city-stage"),t=e?.querySelector(".v6-static-fallback"),world=e?.querySelector(".v5-stage-world");if(!t||!world)return {readable:false,missing:true};const b=world.getBoundingClientRect(),cs=getComputedStyle(t),lines=[...t.querySelectorAll("span,strong,p")].map(n=>{const range=document.createRange();range.selectNodeContents(n);const rects=[...range.getClientRects()].filter(r=>r.width>0&&r.height>0);return {className:n.className,text:n.textContent,rects:rects.map(r=>({left:r.left-b.left,right:r.right-b.left,top:r.top-b.top,bottom:r.bottom-b.top})),inside:rects.length>0&&rects.every(r=>r.left>=b.left-2&&r.right<=b.right+2&&r.top>=b.top-2&&r.bottom<=b.bottom+2)}});return {state:e.dataset.v6State||"initial",visibility:cs.visibility,opacity:Number(cs.opacity),display:cs.display,readable:cs.visibility==="visible"&&cs.display!=="none"&&Number(cs.opacity)>.99&&lines.length===3&&lines.every(n=>n.inside),lines}};const e=document.querySelector("#modelo .v5-city-stage"),t=e?.querySelector(".v6-static-fallback");return {mode:document.documentElement.dataset.v5Mode,textVisible:!!t&&getComputedStyle(t).visibility!=="hidden",fallbackMeasurement:measureFallback(),noImage:!e?.querySelector("img,picture"),gpuHidden:getComputedStyle(e.querySelector(".v6-three-mount")).display==="none",sceneDescription:e?.getAttribute("aria-label"),noBundle:![...document.scripts].some(s=>s.src.includes("v6-three.bundle"))}})()');
    if(v5Reduced.mode!=="reduced"||!v5Reduced.textVisible||!v5Reduced.fallbackMeasurement.readable||!v5Reduced.noImage||!v5Reduced.gpuHidden||!v5Reduced.sceneDescription?.includes("conceptual")||!v5Reduced.noBundle)report.failures.push("Prime reduced-motion fallback "+root+w+": "+JSON.stringify(v5Reduced));
    report.tests.push({name:"V5 image-free reduced-motion fallback / Prime "+root+w,v5Reduced});
    await js('document.querySelector("#modelo .v5-city-stage").scrollIntoView({block:"center",behavior:"instant"})');
    await capture((root?"dist-":"source-")+"prime-3d-reduced-"+w+"px.png");
    await call("Emulation.setEmulatedMedia",{media:"screen",features:[{name:"prefers-reduced-motion",value:"no-preference"}]});
   }
   report.tests.push({name:"Prime page "+root+w,prime});
  }
 }
 // DESSET-NAV: follow the new home CTA in source and package.
 for(const root of ["","dist/"]){
  await call("Page.navigate",{url:pathToFileURL(resolve(root+"index.html")).href});
  await until(async()=>await js("document.readyState==='complete' && !!document.querySelector('.desset-service-cta')"),"DESSET applications entry");
  await js("document.querySelector('.desset-service-cta').click()");
  await until(async()=>await js("document.readyState==='complete' && location.pathname.endsWith('/aplicaciones.html') && !!document.querySelector('.apps-page')"),"DESSET applications destination");
  report.tests.push({name:"DESSET applications navigation "+root,pass:true});
 }
 // PRIME-NAV-01: exercise both public entry points in the exact source and package.
 for(const root of ["","dist/"]){
  for(const selector of ["#soluciones .prime-service-cta",'.corporate-footer a[href="./prime.html"]']){
   await call("Page.navigate",{url:pathToFileURL(resolve(root+"index.html")).href});
   await until(async()=>await js("document.readyState==='complete' && !!document.querySelector("+JSON.stringify(selector)+")"),"Prime entry point");
   await js("document.querySelector("+JSON.stringify(selector)+").click()");
   await until(async()=>await js("document.readyState==='complete' && location.pathname.endsWith('/prime.html') && !!document.querySelector('.prime-page')"),"Prime destination");
   report.tests.push({name:"Prime direct navigation "+root+selector,pass:true});
  }
 }
 // CONTACT-04: responsive directory, disclosure and actual navigation, no collection.
 for(const root of ["","dist/"]){
  for(const [w,h] of [[1440,900],[768,900],[390,844],[320,700]]){
   await call("Emulation.setDeviceMetricsOverride",{width:w,height:h,deviceScaleFactor:1,mobile:w<=800});
   await call("Page.navigate",{url:pathToFileURL(resolve(root+"contacto.html")).href});
   await until(async()=>await js("document.readyState==='complete' && !!document.querySelector('.contact-page')"),"contact page render");
   await js('document.fonts.ready');
   await verifySharedNavigation(root,"contacto",w);
   const contact=await js(`(()=>{const v=document.documentElement.clientWidth,s=[...document.querySelectorAll(".ct-item summary")];return {title:document.querySelector("h1").textContent,width:v,scroll:document.documentElement.scrollWidth,items:s.length,closed:document.querySelectorAll("details[open]").length,forms:document.querySelectorAll("form,input,iframe,textarea").length,social:document.querySelectorAll(".footer-social,[data-footer-channel]").length,fit:s.every(e=>e.clientWidth>=e.scrollWidth-2&&e.getBoundingClientRect().height>=48&&e.querySelector("span").scrollWidth<=e.querySelector("span").clientWidth+2)}})()`);
   if(contact.title!=="Contacto institucional"||contact.scroll>contact.width+2||contact.items!==9||contact.closed||contact.forms||contact.social||!contact.fit)report.failures.push("CONTACT-04 "+root+w+": "+JSON.stringify(contact));
   await capture((root?"dist-":"source-")+"contacto-"+w+"px.png",true);
   await js('document.querySelector(".ct-item summary").click()');
   if(!await js('document.querySelector(".ct-item").open && document.querySelector(".ct-item p").textContent.includes("aún no está habilitado")'))report.failures.push("CONTACT-04 disclosure failed");
   if(!await js('document.querySelector("#alianzas").open && document.querySelector("#alianzas p").textContent.includes("tecnología e integraciones") && document.querySelector("#alianzas p").textContent.includes("viabilidad") && !document.querySelector("#alianzas form,#alianzas input,#alianzas a")'))report.failures.push("PARTNERS-01 scope or inactive channel mismatch");
   report.tests.push({name:"Contact directory "+root+w,contact});
  }
  for(const selector of [".main-nav .nav-contact",'.corporate-footer a[href="./contacto.html"]']){
   await call("Page.navigate",{url:pathToFileURL(resolve(root+"index.html")).href});
   await until(async()=>await js("document.readyState==='complete' && !!document.querySelector("+JSON.stringify(selector)+")"),"Contact entry");
   await js("document.querySelector("+JSON.stringify(selector)+").click()");
   await until(async()=>await js("document.readyState==='complete' && location.pathname.endsWith('/contacto.html') && !!document.querySelector('.contact-page')"),"Contact destination");
   report.tests.push({name:"Contact navigation "+root+selector,pass:true});
  }
 }
 // TRUST-01: directory, actual navigation, safe disclosures and four responsive widths.
 for(const root of ["","dist/"]){
  for(const [w,h] of [[1440,900],[768,900],[390,844],[320,700]]){
   await call("Emulation.setDeviceMetricsOverride",{width:w,height:h,deviceScaleFactor:1,mobile:w<=800});
   await call("Page.navigate",{url:pathToFileURL(resolve(root+"confianza.html")).href});
   await until(async()=>await js("document.readyState==='complete' && !!document.querySelector('.trust-page')"),"trust page render");
   await js('document.fonts.ready');
   await verifySharedNavigation(root,"confianza",w);
   const trust=await js(`(()=>{const v=document.documentElement.clientWidth,s=[...document.querySelectorAll(".tr-item summary")];return {title:document.querySelector("h1").textContent,width:v,scroll:document.documentElement.scrollWidth,items:s.length,closed:document.querySelectorAll("details[open]").length,forms:document.querySelectorAll("form,input,iframe,textarea").length,social:document.querySelectorAll(".footer-social,[data-footer-channel]").length,fit:s.every(e=>e.clientWidth>=e.scrollWidth-2&&e.getBoundingClientRect().height>=48)}})()`);
   if(trust.title!=="Centro de confianza"||trust.scroll>trust.width+2||trust.items!==5||trust.closed||trust.forms||trust.social||!trust.fit)report.failures.push("TRUST-01 "+root+w+": "+JSON.stringify(trust));
   await capture((root?"dist-":"source-")+"confianza-"+w+"px.png",true);
   for(const id of ["seguridad","privacidad","fraudes","incidentes","transparencia"]){
    await js("document.querySelector('#"+id+" summary').click()");
    if(!await js("document.querySelector('#"+id+"').open"))report.failures.push("TRUST-01 disclosure "+id);
   }
   await capture((root?"dist-":"source-")+"confianza-open-"+w+"px.png",true);
   report.tests.push({name:"Trust directory "+root+w,trust});
  }
  await call("Page.navigate",{url:pathToFileURL(resolve(root+"index.html")).href});
  await until(async()=>await js("document.readyState==='complete' && !!document.querySelector('.corporate-footer a[href=\"./confianza.html\"]')"),"Trust entry");
  await js('document.querySelector(\'.corporate-footer a[href="./confianza.html"]\').click()');
  await until(async()=>await js("document.readyState==='complete' && location.pathname.endsWith('/confianza.html') && !!document.querySelector('.trust-page')"),"Trust destination");
  await js('document.querySelector("#incidentes summary").click()');
  await js('document.querySelector("#incidentes a").click()');
  await until(async()=>await js("document.readyState==='complete' && location.pathname.endsWith('/contacto.html') && location.hash==='#seguridad' && !!document.querySelector('.contact-page')"),"Trust incident contact destination");
  report.tests.push({name:"Trust navigation and incident route "+root,pass:true});
 }
 // NEWS-01: real filter selection, brand disclosure, responsive source and dist.
 for(const root of ["","dist/"]){
  for(const [w,h] of [[1440,900],[768,900],[390,844],[320,700]]){
   await call("Emulation.setDeviceMetricsOverride",{width:w,height:h,deviceScaleFactor:1,mobile:w<=800});
   await call("Page.navigate",{url:pathToFileURL(resolve(root+"noticias.html")).href});
   await until(async()=>await js("document.readyState==='complete' && !!document.querySelector('.news-page')"),"news page render");
   await js('document.fonts.ready');
   await verifySharedNavigation(root,"noticias",w);
   const news=await js(`(()=>{const v=document.documentElement.clientWidth;return {title:document.querySelector("h1").textContent,width:v,scroll:document.documentElement.scrollWidth,filters:document.querySelectorAll(".nw-filter input[type=radio]").length,selected:document.querySelector(".nw-filter input:checked").id,forms:document.querySelectorAll("form,iframe,textarea,script:not([src='./scripts/app.js']),input:not([type=radio])").length,social:document.querySelectorAll(".footer-social,[data-footer-channel]").length,fit:[...document.querySelectorAll(".nw-filter label")].every(e=>e.getBoundingClientRect().height>=44)}})()`);
   if(news.title!=="Sala de noticias."||news.scroll>news.width+2||news.filters!==4||news.selected!=="nw-all"||news.forms||news.social||!news.fit)report.failures.push("NEWS-01 "+root+w+": "+JSON.stringify(news));
   await capture((root?"dist-":"source-")+"noticias-"+w+"px.png",true);
   for(const id of ["nw-press","nw-announcements","nw-media","nw-all"]){
    await js("document.querySelector('label[for="+id+"]').click()");
    const selected=await js("(()=>({id:document.querySelector('.nw-filter input:checked').id,visible:[...document.querySelectorAll('.nw-state')].filter(e=>getComputedStyle(e).display!=='none').map(e=>e.className)}))()");
    if(selected.id!==id||selected.visible.length!==1||selected.visible[0]!=="nw-state "+id)report.failures.push("NEWS-01 filter "+JSON.stringify(selected));
   }
   await js('document.querySelector("#recursos-de-marca summary").click()');
   if(!await js('document.querySelector("#recursos-de-marca").open && document.querySelector(".nw-brand-content").innerText.includes("colaboradores autorizados") && !document.querySelector("#recursos-de-marca img,#recursos-de-marca a[download],#recursos-de-marca a[href*=assets]")'))report.failures.push("NEWS-01 restricted brand request failed");
   await capture((root?"dist-":"source-")+"noticias-open-"+w+"px.png",true);
   report.tests.push({name:"News directory "+root+w,news});
  }
  await call("Page.navigate",{url:pathToFileURL(resolve(root+"index.html")).href});
  await until(async()=>await js("document.readyState==='complete' && !!document.querySelector('.corporate-footer a[href=\"./noticias.html\"]')"),"News entry");
  await js('document.querySelector(\'.corporate-footer a[href="./noticias.html"]\').click()');
  await until(async()=>await js("document.readyState==='complete' && location.pathname.endsWith('/noticias.html') && !!document.querySelector('.news-page')"),"News destination");
  await js('document.querySelector("#recursos-de-marca summary").click()');
  await js('document.querySelector(".nw-brand-content a").click()');
  await until(async()=>await js("document.readyState==='complete' && location.pathname.endsWith('/contacto.html') && location.hash==='#prensa' && !!document.querySelector('.contact-page')"),"News press contact destination");
  report.tests.push({name:"News navigation and press route "+root,pass:true});
 }
 // CAREERS-01: culture, no application collection, responsive source and dist.
 for(const root of ["","dist/"]){
  for(const [w,h] of [[1440,900],[1028,900],[768,900],[390,844],[351,844],[320,700]]){
   await call("Emulation.setDeviceMetricsOverride",{width:w,height:h,deviceScaleFactor:1,mobile:w<=800});
   await call("Page.navigate",{url:pathToFileURL(resolve(root+"talento.html")).href});
   await until(async()=>await js("document.readyState==='complete' && !!document.querySelector('.careers-page')"),"careers page render");
   await js('document.fonts.ready');
   await verifySharedNavigation(root,"talento",w);
   const careers=await js(`(()=>{const v=document.documentElement.clientWidth;return {title:document.querySelector("h1").textContent,width:v,scroll:document.documentElement.scrollWidth,values:[...document.querySelectorAll(".ca-values li span")].map(e=>e.textContent),forms:document.querySelectorAll("form,iframe,textarea,script:not([src='./scripts/app.js']),input").length,social:document.querySelectorAll(".footer-social,[data-footer-channel]").length,closed:document.querySelector("#oportunidades").textContent.includes("no se reciben candidaturas"),fit:[...document.querySelectorAll(".ca-values li")].every(e=>e.getBoundingClientRect().height>=48&&e.scrollWidth<=e.clientWidth+2)}})()`);
   if(careers.title!=="El futuro lo construyen las personas."||careers.scroll>careers.width+2||careers.values.join("|")!=="Innovación con propósito|Excelencia en la ejecución|Responsabilidad compartida|Aprendizaje continuo"||careers.forms||careers.social||!careers.closed||!careers.fit)report.failures.push("CAREERS-01 "+root+w+": "+JSON.stringify(careers));
   const photo=await js(`(()=>{const t=document.querySelector(".ca-hero"),i=t.querySelector("img"),c=t.querySelector(".ca-hero-copy"),r=t.getBoundingClientRect(),p=i.getBoundingClientRect(),b=c.getBoundingClientRect(),h=c.querySelector("h1"),d=c.querySelector("p");function lines(el){const n=el.firstChild,q=document.createRange(),rows=[];for(let k=0;k<n.length;k++){q.setStart(n,k);q.setEnd(n,k+1);const y=q.getBoundingClientRect().top;if(!rows.length||Math.abs(rows.at(-1).y-y)>1)rows.push({y,s:""});rows.at(-1).s+=n.textContent[k]}return rows.map(row=>row.s.trim())}return {titleLines:lines(h),bodyLines:lines(d),titleWeight:getComputedStyle(h).fontWeight,titleFont:getComputedStyle(h).fontFamily,copyTop:(h.getBoundingClientRect().top-r.top)/r.height,copyLeft:(h.getBoundingClientRect().left-r.left)/r.width,bodyBottom:(d.getBoundingClientRect().bottom-r.top)/r.height,source:i.getAttribute("src"),loaded:i.complete&&i.naturalWidth===1200&&i.naturalHeight===1800,full:Math.abs(r.width-p.width)<2&&Math.abs(r.height-p.height)<2&&Math.abs(r.left-p.left)<2&&Math.abs(r.top-p.top)<2&&Math.abs(r.width-document.documentElement.clientWidth)<2,fit:getComputedStyle(i).objectFit,position:getComputedStyle(i).objectPosition,overlay:getComputedStyle(t,"::after").backgroundImage,titleInk:getComputedStyle(h).color,bodyInk:getComputedStyle(d).color,inside:b.left>=r.left-2&&b.right<=r.right+2&&b.top>=r.top-2&&b.bottom<=r.bottom+2,bottom:Math.abs(b.bottom-r.bottom)<2,center:Math.abs((b.top+b.bottom-r.top-r.bottom)/2)<2,extra:c.querySelectorAll("p").length!==1||!!t.querySelector(".ca-kicker,figcaption,button,a"),height:r.height,overflow:h.scrollWidth>h.clientWidth+2||d.scrollWidth>d.clientWidth+2}})()`);
   if(photo.source!=="./assets/talento-cultura.webp"||!photo.loaded||!photo.full||photo.fit!=="cover"||photo.position!=="50% 40%"||!photo.overlay.includes("linear-gradient("+(w<=780?"0deg":"90deg"))||photo.titleInk!=="rgb(255, 255, 255)"||photo.bodyInk!=="rgb(255, 255, 255)"||!photo.inside||photo.extra||photo.overflow||(w<=780?(!photo.bottom||photo.height<435):(!photo.center||photo.height<380)))report.failures.push("PHOTO-04 "+root+w+": "+JSON.stringify(photo));
   // Visual contract from the approved 1028x459 and 351x477 references; compare real rendered word ranges, not CSS alone.
   const mobile=w<=780, expectedTitle=mobile?["El futuro lo","construyen las","personas."]:["El futuro lo construyen las","personas."], expectedBody=w<=390?["Una cultura basada en la","responsabilidad, el aprendizaje y la","capacidad de transformar ideas en","soluciones reales."]:["Una cultura basada en la responsabilidad,","el aprendizaje y la capacidad de","transformar ideas en soluciones reales."];
   const expectedHeight=mobile?Math.min(600,Math.max(435,1.36*w)):Math.min(640,Math.max(380,.4465*w));
   if(JSON.stringify(photo.titleLines)!==JSON.stringify(expectedTitle)||JSON.stringify(photo.bodyLines)!==JSON.stringify(expectedBody)||photo.titleWeight!=="900"||!photo.titleFont.includes("DESSET Inter")||Math.abs(photo.height-expectedHeight)>2||Math.abs(photo.copyLeft-(mobile ? .055 : .051))>.012||photo.copyTop<(mobile ? .30 : .20)||photo.copyTop>(mobile ? .52 : .34)||photo.bodyBottom<(mobile ? .77 : .62)||photo.bodyBottom>(mobile ? .91 : .76))report.failures.push("PHOTO-04 reference geometry "+root+w+": "+JSON.stringify(photo));
   report.tests.push({name:"PHOTO-04 Talent full-bleed "+root+w,photo});
   await capture((root?"dist-":"source-")+"talento-"+w+"px.png",true);
   const talentStructure=await js(`(()=>{const m=document.querySelector("main");return {sections:m.querySelectorAll("section").length,ids:[...m.querySelectorAll("section[id]")].map(x=>x.id),areas:m.querySelectorAll(".ca-areas li").length,principles:m.querySelectorAll(".ca-principles li").length,selection:m.querySelectorAll(".ca-selection li").length,faq:m.querySelectorAll(".ca-faq details").length,images:m.querySelectorAll("img,video").length,link:m.querySelector("#cierre a").getAttribute("href"),inactive:m.querySelector("#seleccion").textContent.includes("todavía no habilitado"),controls:[...m.querySelectorAll("summary,.ca-button")].every(e=>e.getBoundingClientRect().height>=44),overflow:[...m.querySelectorAll("h2,h3,p,li,summary")].filter(e=>!e.closest("details:not([open])")&&(e.getBoundingClientRect().width<=0||e.scrollWidth>e.clientWidth+2)).map(e=>({tag:e.tagName,text:e.textContent.slice(0,80)}))}})()`);
   if(talentStructure.sections!==9||talentStructure.ids.join("|")!=="proposito|cultura|areas|trabajo|seleccion|oportunidades|preguntas|cierre"||talentStructure.areas!==8||talentStructure.principles!==5||talentStructure.selection!==7||talentStructure.faq!==6||talentStructure.images!==1||talentStructure.link!=="./empresa.html"||!talentStructure.inactive||!talentStructure.controls||talentStructure.overflow.length)report.failures.push("CAREERS-02 "+root+w+": "+JSON.stringify(talentStructure));
   report.tests.push({name:"CAREERS-02 nine approved sections "+root+w,talentStructure});
   report.tests.push({name:"Careers page "+root+w,careers});
  }
  await call("Page.navigate",{url:pathToFileURL(resolve(root+"index.html")).href});
  await until(async()=>await js("document.readyState==='complete' && !!document.querySelector('.corporate-footer a[href=\"./talento.html\"]')"),"Careers entry");
  await js('document.querySelector(\'.corporate-footer a[href="./talento.html"]\').click()');
  await until(async()=>await js("document.readyState==='complete' && location.pathname.endsWith('/talento.html') && !!document.querySelector('.careers-page')"),"Careers destination");
  await call("Page.navigate",{url:pathToFileURL(resolve(root+"contacto.html")).href});
  await until(async()=>await js("document.readyState==='complete' && !!document.querySelector('#profesionales a')"),"Careers contact entry");
  await js('document.querySelector("#profesionales summary").click()');
  await js('document.querySelector("#profesionales a").click()');
  await until(async()=>await js("document.readyState==='complete' && location.pathname.endsWith('/talento.html') && !!document.querySelector('.careers-page')"),"Careers contact destination");
  report.tests.push({name:"Careers navigation "+root,pass:true});
 }
 // GLOBAL-01: English overview, explicit return to Spanish, no independent claims.
 for(const root of ["","dist/"]){
  for(const [w,h] of [[1440,900],[768,900],[390,844],[320,700]]){
   await call("Emulation.setDeviceMetricsOverride",{width:w,height:h,deviceScaleFactor:1,mobile:w<=800});
   await call("Page.navigate",{url:pathToFileURL(resolve(root+"en.html")).href});
   await until(async()=>await js("document.readyState==='complete' && document.documentElement.lang==='en'"),"English overview");
   await js('document.fonts.ready');
   const english=await js(`(()=>{const v=document.documentElement.clientWidth;return {title:document.querySelector("h1").textContent,lang:document.documentElement.lang,width:v,scroll:document.documentElement.scrollWidth,sections:[...document.querySelectorAll("main section")].map(e=>e.id),back:document.querySelector("header a[hreflang=es]").getAttribute("href"),forms:document.querySelectorAll("form,input,script,iframe,textarea").length,notice:document.querySelector("#information").textContent.includes("currently available in Spanish"),fit:[...document.querySelectorAll("main section")].every(e=>e.scrollWidth<=e.clientWidth+2)}})()`);
   if(english.title!=="DESSET — International overview"||english.lang!=="en"||english.sections.join("|")!=="about|business|principles|status|information"||english.scroll>english.width+2||english.back!=="./empresa.html"||english.forms||!english.notice||!english.fit)report.failures.push("GLOBAL-01 "+root+w+": "+JSON.stringify(english));
   await capture((root?"dist-":"source-")+"en-"+w+"px.png",true);
  }
  await call("Page.navigate",{url:pathToFileURL(resolve(root+"empresa.html")).href});
  await until(async()=>await js("document.readyState==='complete' && !!document.querySelector('a[hreflang=en]')"),"English language entry");
  await js('document.querySelector("a[hreflang=en]").click()');
  await until(async()=>await js("document.readyState==='complete' && location.pathname.endsWith('/en.html') && document.documentElement.lang==='en'"),"English language destination");
  await js('document.querySelector("header a[hreflang=es]").click()');
  await until(async()=>await js("document.readyState==='complete' && location.pathname.endsWith('/empresa.html') && document.documentElement.lang==='es'"),"Spanish language return");
  report.tests.push({name:"Global language navigation "+root,pass:true});
 }
 // Merchant onboarding preview: responsive disabled fields and no collection.
 for(const root of ["","dist/"]){
  for(const [w,h] of [[1440,900],[768,900],[390,844],[320,700]]){
   await call("Emulation.setDeviceMetricsOverride",{width:w,height:h,deviceScaleFactor:1,mobile:w<=800});
   for(const page of ["registro-comercios","incorporacion-comercios","registro-repartidores","incorporacion-repartidores","capacitacion-repartidores"]){
    await call("Page.navigate",{url:pathToFileURL(resolve(root+page+".html")).href});
    await until(async()=>await js("document.readyState==='complete' && !!document.querySelector('.onboarding-page')"),"onboarding page");
    const state=await js(`(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,forms:document.querySelectorAll("form,script,iframe").length,enabled:document.querySelectorAll("input:enabled,select:enabled,textarea:enabled,button:enabled").length,notice:document.querySelector(".ob-notice").textContent,fields:document.querySelectorAll("fieldset").length}))()`);
    if(state.scroll>state.width+2||state.forms||state.enabled||(!state.notice.includes("actualmente")&&!state.notice.includes("aún no está habilitada"))||state.fields!==(page.startsWith("registro-")?2:0))report.failures.push("ONBOARDING "+root+page+w+": "+JSON.stringify(state));
    await capture((root?"dist-":"source-")+page+"-"+w+"px.png",true);
   }
  }
 }
 // APP-DISTRIBUTION-01 closed directory: actual responsive DOM and manual controls.
 for(const root of ["","dist/"]){
  for(const [w,h] of [[1440,900],[768,900],[390,844],[320,700]]){
   await call("Emulation.setDeviceMetricsOverride",{width:w,height:h,deviceScaleFactor:1,mobile:w<=800});
   for(const page of ["aplicaciones","aplicaciones-clientes","aplicaciones-comercios","aplicaciones-repartidores"]){
    await call("Page.navigate",{url:pathToFileURL(resolve(root+page+".html")).href});
    await until(async()=>await js("document.readyState==='complete' && !!document.querySelector('.apps-page')"),"app directory render");
    if(page==="aplicaciones"){await js('document.fonts.ready');await verifySharedNavigation(root,page,w);}
    const a=await js(`(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,panels:document.querySelectorAll("[data-app-role]").length,downloads:[...document.querySelectorAll("[data-app-download]")].every(e=>e.textContent==="Descarga no disponible."),links:document.querySelectorAll("[data-app-links] a, a[download], form, iframe").length,country:document.querySelector("[data-app-country]")?.value??null,buttons:document.querySelectorAll("[data-app-platform]").length}))()`);
    if(a.scroll>a.width+2||a.panels!==(page==="aplicaciones"?3:1)||!a.downloads||a.links||a.country!==(page==="aplicaciones"?null:"PE")||a.buttons!==(["aplicaciones","aplicaciones-clientes"].includes(page)?0:3))report.failures.push("APP-DISTRIBUTION "+root+page+w+": "+JSON.stringify(a));
    if(page==="aplicaciones"){
     const logo=await js(`(()=>{const a=document.querySelector(".apps-card>a.apps-icon-desset"),r=a?.getBoundingClientRect(),p=a?.parentElement.getBoundingClientRect();return {href:a?.getAttribute("href"),width:r?.width,height:r?.height,centered:!!r&&Math.abs((r.left+r.right-p.left-p.right)/2)<2,loaded:a?.querySelector("img")?.naturalWidth,onlyImage:a?.children.length===1&&a.textContent.trim()==="",country:!!document.querySelector("[data-app-country]")}})()`);
     if(logo.href!=="./aplicaciones-clientes.html"||logo.width<44||Math.abs(logo.width-logo.height)>2||!logo.centered||!logo.loaded||!logo.onlyImage||logo.country)report.failures.push("APP-DIRECTORY-LOGO-01 "+root+w+": "+JSON.stringify(logo));
     report.tests.push({name:"APP-DIRECTORY-LOGO-01 "+root+w,logo});
     await js("window.scrollTo(0,0)");
     await until(async()=>await js('(()=>{const v=document.querySelector(".apps-hero-video");return !!v&&v.readyState>=2&&v.videoWidth===1920&&v.videoHeight===1080&&!v.paused&&v.currentTime>0})()'),"application hero video playing");
     const hero=await js(`(()=>{const t=document.querySelector(".apps-hero--video"),v=t.querySelector("video"),h=t.querySelector("h1"),p=t.querySelector("p"),r=t.getBoundingClientRect(),b=v.getBoundingClientRect(),copy=t.querySelector(".apps-hero-copy").getBoundingClientRect();return {source:v.dataset.src,loop:v.loop,muted:v.muted,inline:v.playsInline,controls:v.controls,buttons:t.querySelectorAll("button").length,poster:v.hasAttribute("poster"),fit:getComputedStyle(v).objectFit,full:Math.abs(b.width-r.width)<2&&Math.abs(b.height-r.height)<2,ink:getComputedStyle(h).color,subtitleAbsent:!p,inside:copy.left>=r.left-2&&copy.right<=r.right+2&&copy.top>=r.top-2&&copy.bottom<=r.bottom+2,duration:v.duration,overflow:h.scrollWidth>h.clientWidth+2}})()`);
     if(hero.source!=="./assets/aplicaciones-hero.mp4"||!hero.loop||!hero.muted||!hero.inline||hero.controls||hero.buttons||hero.poster||hero.fit!=="cover"||!hero.full||hero.ink!=="rgb(255, 255, 255)"||!hero.subtitleAbsent||!hero.inside||hero.overflow||hero.duration<1||hero.duration>1.2)report.failures.push("APP-HERO-VIDEO-01 "+root+w+": "+JSON.stringify(hero));
     await js('(()=>{const v=document.querySelector(".apps-hero-video");v.currentTime=v.duration-.15})()');
     await until(async()=>await js('(()=>{const v=document.querySelector(".apps-hero-video");return v.currentTime<.7&&!v.paused&&!v.ended})()'),"application hero crosses loop boundary");
     await call("Emulation.setEmulatedMedia",{media:"screen",features:[{name:"prefers-reduced-motion",value:"reduce"}]});
     await until(async()=>await js('(()=>{const v=document.querySelector(".apps-hero-video");return v.paused&&getComputedStyle(v).display==="none"})()'),"application hero reduced motion");
     await call("Emulation.setEmulatedMedia",{media:"screen",features:[{name:"prefers-reduced-motion",value:"no-preference"}]});
     await until(async()=>await js('!document.querySelector(".apps-hero-video").paused'),"application hero resumes");
     report.tests.push({name:"APP-HERO-VIDEO-01 "+root+w,hero});
    }else if(page==="aplicaciones-clientes"){
     const c=await js(`(()=>{const p=document.querySelector(".consumer-compact"),buttons=[...p.querySelectorAll(".consumer-accesses button")],menu=document.querySelector(".consumer-menu"),coverage=document.querySelector(".consumer-coverage");menu.querySelector("summary").click();const menuOpened=menu.open;menu.querySelector("summary").click();coverage.querySelector("summary").click();const coverageOpened=coverage.open;coverage.querySelector("summary").click();return {buttons:buttons.length,closed:buttons.every(b=>b.disabled),categories:p.querySelectorAll(".consumer-category").length,menuOpened,coverageOpened,logo:p.querySelector("img").naturalWidth,ctaVisible:buttons.every(b=>b.getBoundingClientRect().bottom<=innerHeight+2)}})()`);
     if(c.buttons!==3||!c.closed||c.categories!==4||!c.menuOpened||!c.coverageOpened||!c.logo||!c.ctaVisible)report.failures.push("APP-CONSUMER-02 compact "+root+w+": "+JSON.stringify(c));
    }else{
     const manual=await js(`(()=>{document.querySelector('[data-app-platform="ios"]').click();const country=document.querySelector("[data-app-country]");country.value="OTHER";country.dispatchEvent(new Event("change"));return {selected:document.querySelector('[data-app-platform="ios"]').getAttribute("aria-pressed"),hidden:document.querySelector("[data-app-links]").hidden,count:document.querySelectorAll("[data-app-links] a").length}})()`);
     if(manual.selected!=="true"||!manual.hidden||manual.count)report.failures.push("APP-DISTRIBUTION manual selection "+root+page+w);
    }
    await capture((root?"dist-":"source-")+page+"-"+w+"px.png",true);
   }
  }
 }
 await auditPrivateMerchant({call,js,until,capture,report});
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
