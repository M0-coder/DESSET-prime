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
async function viewport(width,height,reduce=false,entry=URL){
 await call("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:width<=800});
 await call("Emulation.setEmulatedMedia",{media:"screen",features:[{name:"prefers-reduced-motion",value:reduce?"reduce":"no-preference"}]});
 await call("Page.navigate",{url:entry});
 await until(async()=>await js("document.readyState==='complete' && !!document.querySelector('.hero--motion')"),"page render");
 await js('document.fonts.ready');
 // PRIME-COLOR-02 must sample the final opaque CTA, not a partial CSS
 // background transition. Fail closed if it never becomes fully opaque.
 await until(async()=>await js(`(()=>{
   const el=document.querySelector("#inicio .hero-cta");
   if(!el)return false;
   const color=getComputedStyle(el).backgroundColor;
   const match=color.match(/^rgba\\(\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*([\\d.]+)\\s*\\)$/);
   return !match||Number(match[1])>=0.9999;
 })()`),"fully opaque hero CTA background after its CSS transition");
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
   textFits:!!title&&!!copy&&title.scrollWidth<=title.clientWidth+2&&copy.scrollWidth<=copy.clientWidth+2,
   fontPx:parseFloat(copyStyle?.fontSize),icon:svg?.getAttribute("aria-hidden")==="true"};
 });
 const railDisplay={background:getComputedStyle(rail).backgroundColor,
  columns:getComputedStyle(rail).gridTemplateColumns.trim().split(/\\s+/).length,
  role:rail.getAttribute("role"),ariaHidden:rail.getAttribute("aria-hidden"),
  left:Math.round(railBox.left),right:Math.round(railBox.right),viewportRight:document.documentElement.clientWidth};
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
    fits:h.scrollWidth<=h.clientWidth+2&&p.scrollWidth<=p.clientWidth+2,
    photoRatio:photo.width/photo.height,fit:getComputedStyle(image).objectFit,
    titleFont:parseFloat(getComputedStyle(h).fontSize),copyFont:parseFloat(getComputedStyle(p).fontSize)};
  })};
 const servicesGrid=document.querySelector("#soluciones .solutions-grid");
 const servicesBounds=servicesGrid.getBoundingClientRect();
 const servicesSheet=document.querySelector('link[href^="./styles.css?v="]');
 const servicesLayout={sheetLoaded:!!servicesSheet?.sheet,revision:servicesSheet?.getAttribute("href"),surface:getComputedStyle(servicesGrid.closest("section")).backgroundColor,gap:parseFloat(getComputedStyle(servicesGrid).gap),columns:getComputedStyle(servicesGrid).gridTemplateColumns.trim().split(/\\s+/).length,
  headingAbsent:!document.querySelector("#soluciones > h2"),label:document.querySelector("#soluciones").getAttribute("aria-label"),
  cards:[...servicesGrid.querySelectorAll("article.service")].map(c=>{
   const r=c.getBoundingClientRect(),h=c.querySelector("h3"),p=c.querySelector("p"),s=c.querySelector("strong");
   const style=getComputedStyle(c),brandRect=h.getBoundingClientRect(),textRect=s.getBoundingClientRect(),last=p.getBoundingClientRect(),prime=h.querySelector("span");
   return {brand:h.textContent.trim(),service:s.textContent.trim(),copy:p.textContent.trim(),background:style.backgroundColor,borderWidth:style.borderTopWidth,borderColor:style.borderTopColor,radius:parseFloat(style.borderTopLeftRadius),shadow:style.boxShadow,primeColor:prime?getComputedStyle(prime).color:null,divider:getComputedStyle(s).borderTopWidth,descriptionColor:getComputedStyle(p).color,alignedCopy:getComputedStyle(s).textAlign==="left"&&getComputedStyle(p).textAlign==="left",bottomSpace:r.bottom-last.bottom,brandBottom:brandRect.bottom-r.top,dividerOffset:textRect.top-r.top,centered:getComputedStyle(h).textAlign==="center"&&getComputedStyle(h).alignItems==="center"&&getComputedStyle(h).justifyContent==="center",brandHeight:h.getBoundingClientRect().height,primeStack:!h.querySelector("span")||getComputedStyle(h.querySelector("span")).display==="block",
    visible:r.height>100&&getComputedStyle(c).visibility!=="hidden",
    inside:r.left>=servicesBounds.left-2&&r.right<=servicesBounds.right+2,
    fits:[h,p,s].every(e=>e.scrollWidth<=e.clientWidth+2),height:r.height,
    copyFont:parseFloat(getComputedStyle(p).fontSize)};
  })};
 const partnersGrid=document.querySelector("#negocios .audience-grid--compact");
 const partnersBounds=partnersGrid.getBoundingClientRect();
 const close=document.querySelector("#contacto"),heading=close.querySelector("h2"),lines=[...heading.querySelectorAll(".closing-line")],headingStyle=getComputedStyle(heading);
 const partnerLayout={closing:{joined:close.parentElement===partnersGrid.parentElement&&close.nextElementSibling===partnersGrid,background:getComputedStyle(close.parentElement).backgroundColor,headerBackground:getComputedStyle(close).backgroundColor,align:headingStyle.textAlign,font:parseFloat(headingStyle.fontSize),words:lines.map(l=>l.textContent.trim()),colors:lines.map(l=>getComputedStyle(l.querySelector("em")||l).color),decorAbsent:[close,...lines].every(l=>["::before","::after"].every(p=>["none","normal"].includes(getComputedStyle(l,p).content))),cardFonts:[...partnersGrid.querySelectorAll("h3")].map(h=>parseFloat(getComputedStyle(h).fontSize))},columns:getComputedStyle(partnersGrid).gridTemplateColumns.trim().split(/\\s+/).length,gap:parseFloat(getComputedStyle(partnersGrid).gap),
 cards:[...partnersGrid.querySelectorAll(":scope > article")].map(c=>{
  const r=c.getBoundingClientRect(),h=c.querySelector("h3"),p=c.querySelector("p"),a=c.querySelector("a"),s=getComputedStyle(c),ar=a.getBoundingClientRect();
  return {title:h.textContent.trim(),label:a.textContent.trim(),accessibleLabel:a.getAttribute("aria-label"),buttonBg:getComputedStyle(a).backgroundColor,buttonInk:getComputedStyle(a).color,buttonWidth:ar.width,cardContentWidth:c.clientWidth-parseFloat(s.paddingLeft)-parseFloat(s.paddingRight),href:a.getAttribute("href"),height:r.height,inside:r.left>=partnersBounds.left-2&&r.right<=partnersBounds.right+2,fit:[h,p,a].every(e=>e.scrollWidth<=e.clientWidth+2),tap:ar.height,icon:c.querySelector("svg")?.getAttribute("aria-hidden"),background:s.backgroundColor,border:s.borderTopWidth,radius:parseFloat(s.borderTopLeftRadius),shadow:s.boxShadow,decoration:getComputedStyle(c,"::before").content};
 })};
 const footerNav=document.querySelector(".corporate-footer");
 const footerLayout={columns:getComputedStyle(footerNav).gridTemplateColumns.trim().split(/\\s+/).length,links:[...footerNav.querySelectorAll("a")].map(e=>({href:e.getAttribute("href"),inside:e.getBoundingClientRect().left>=0&&e.getBoundingClientRect().right<=viewport+2,height:e.getBoundingClientRect().height})),groups:[...footerNav.querySelectorAll("strong")].map(e=>e.textContent),social:[...document.querySelectorAll(".footer-social a")].map(e=>({label:e.getAttribute("aria-label"),height:e.getBoundingClientRect().height,width:e.getBoundingClientRect().width})),center:getComputedStyle(document.querySelector(".footer-social")).justifyContent,copyright:document.querySelector(".site-footer>p").textContent};
 const typeSizes={
  heroLead:parseFloat(getComputedStyle(document.querySelector(".hero-lead")).fontSize),
  serviceTitle:parseFloat(getComputedStyle(document.querySelector(".solutions .service--main h3")).fontSize),
  storyTitle:parseFloat(getComputedStyle(document.querySelector(".motion-story-unit h3")).fontSize)
 };

  const style=selector=>getComputedStyle(document.querySelector(selector));
  const palette={
   rootYellow:style(":root").getPropertyValue("--yellow").trim().toUpperCase(),
   stageYellow:style("#ecosistema").getPropertyValue("--yellow").trim().toUpperCase(),
   stageDesignGold:style("#ecosistema").getPropertyValue("--ds-10-gold").trim().toUpperCase(),
   stageVisualGold:style("#ecosistema").getPropertyValue("--v02-gold").trim().toUpperCase(),
   heroCTA:style("#inicio .hero-cta").backgroundColor,
   businessCTA:style("#negocios .business-pitch-cta").backgroundColor,
   statementAccent:style("#vision h2 span").color,
   stageSummaryArrow:style("#ecosistema .v4-architecture-details summary span").color,
   threeTourButton:style("#ecosistema .v63-tour").backgroundColor,
   threePauseButton:style("#ecosistema .v6-pause").backgroundColor,
   stageFrame:style("#ecosistema .v5-city-stage").backgroundColor,
   stageToolbar:style("#ecosistema .v6-three-toolbar").backgroundColor,
   ecosystemBoard:style("#ecosistema .ecosystem-board").backgroundColor,
   statementBackground:style("#vision").backgroundColor,
   footerBackground:style(".site-footer").backgroundColor,
   navContactBackground:style(".main-nav .nav-contact").backgroundColor,
   primeHeadingColor:style("#desset-prime-heading").color,
   primeSubtitleColor:style("#ecosistema .prime-3d-heading p").color,
   primeKickerColor:style("#ecosistema .prime-3d-heading p strong").color,
   brandNameInk:style(".site-header .brand-name").color,
   footerBrandInk:style(".footer-brand").color,
   footerCopyInk:style(".site-footer>p").color,
   institutionalInk:style(":root").getPropertyValue("--ds-30-ink").trim().toLowerCase(),
   heroHeadingColor:style("#inicio .v4-headline-a").color,
   heroCtaInk:style("#inicio .hero-cta").color,
   heroPhotoFallbackBg:style("#inicio .prime-photo-surface").backgroundColor
  };
 return {decorativeArrowCount:[...document.querySelectorAll("a,button,summary")].filter(e=>/[↗→➜]/.test(e.textContent)).length,viewport,scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight,logo,text,heroFit,offscreen:nodes,railItems,railDisplay,typeSizes,palette,participantLayout,servicesLayout,partnerLayout,footerLayout,menuLabel:document.querySelector(".menu-button")?.getAttribute("aria-label"),disclosures:{technical:document.querySelector('.v4-architecture-details')?.open,obsoleteServices:!!document.querySelector('.future-services')},navDisplay:getComputedStyle(document.querySelector('.main-nav')).display,animation:getComputedStyle(document.querySelector('.motion-line__inner')).animationName};
})()`);
 const fails=[];
 if(diag.scrollWidth>width+2)fails.push("horizontal scroll "+diag.scrollWidth+" > "+width);
  if(diag.disclosures.technical!==false||diag.disclosures.obsoleteServices)fails.push("Freshly navigated page: technical disclosure CLOSED; obsolete services absent: "+JSON.stringify(diag.disclosures));
  const expectedOriginal="rgb(255, 198, 47)";
  const brandBlue="rgb(21, 81, 216)",pureWhite="rgb(255, 255, 255)",paleBlue="rgb(244, 248, 254)";
  const palette=diag.palette;
  // The final computed color is checked only after the background settles.
  // Never accept a semi-transparent or differently colored CTA as a PASS.
  const limeChannels=palette.heroCTA.match(/^rgba?\(205,\s*252,\s*138(?:,\s*([\d.]+))?\)$/);
  const exactLime=!!limeChannels&&(limeChannels[1]===undefined||
   (Number(limeChannels[1])>=.9999&&Number(limeChannels[1])<=1));
  if(palette.rootYellow!=="#FFC62F"||palette.stageYellow!=="#FFC62F"||
   palette.stageDesignGold!=="#FFC62F"||palette.stageVisualGold!=="#FFC62F"||
   !exactLime||palette.businessCTA!==brandBlue||
   palette.statementAccent!==brandBlue||palette.stageSummaryArrow!==expectedOriginal||
   palette.threeTourButton!==pureWhite||palette.threePauseButton!==pureWhite||
   palette.stageFrame!==paleBlue||palette.stageToolbar!==paleBlue||
   palette.ecosystemBoard!==pureWhite||palette.statementBackground!==paleBlue||
   palette.footerBackground!=="rgb(241, 245, 250)"||palette.navContactBackground!==pureWhite||
   palette.primeHeadingColor!==brandBlue||palette.primeSubtitleColor!=="rgb(17, 17, 17)"||
   palette.primeKickerColor!=="rgb(17, 17, 17)"||
   palette.institutionalInk!=="#111111"||
   palette.heroHeadingColor!=="rgb(17, 17, 17)"||
   palette.heroCtaInk!=="rgb(17, 17, 17)"||
   palette.heroPhotoFallbackBg!==paleBlue||
   palette.brandNameInk!=="rgb(17, 17, 17)"||
   palette.footerBrandInk!==brandBlue||palette.footerCopyInk!=="rgb(86, 86, 86)")
   fails.push("PRIME-COLOR-02: only the hero CTA may be lime; brand yellow preserved, page surfaces pale and 3D controls white: "+JSON.stringify(palette));
 if(diag.text.some(t=>t.contentWidth>t.visibleWidth+2))fails.push("clipped hero headline");
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
 if(diag.railItems.length!==4||diag.railItems.some(i=>!i.visible||!i.inside||!i.textFits||!i.icon||i.fontPx<12)||
    diag.railDisplay.background!==brandBlue||diag.railDisplay.role!=="list"||diag.railDisplay.ariaHidden!==null||
    diag.railDisplay.columns!==(width<=860?2:4)||
   (diag.railDisplay.left>2||diag.railDisplay.left< -16)||
   (diag.railDisplay.right<diag.railDisplay.viewportRight-2||diag.railDisplay.right>diag.railDisplay.viewportRight+16))
   fails.push("HERO-SERVICE-01: accessible service strip clips content or has wrong layout: "+JSON.stringify({items:diag.railItems,layout:diag.railDisplay}));
 const participants=diag.participantLayout;
 const expectedParticipantTitles=["PROVEEDORES","COMERCIOS","PERSONAS","OPERADORES LOGÍSTICOS"];
 const expectedParticipantFiles=["./assets/ecosistema-proveedores.webp","./assets/ecosistema-comercios.webp","./assets/ecosistema-consumidores.webp","./assets/ecosistema-operadores-logisticos.webp"];
 if(participants.columns!==(width<=480?1:width<=1000?2:4)||!participants.headingAbove||participants.left< -2||participants.right>diag.viewport+2||
  participants.obsoleteNote||participants.cards.length!==4||
  participants.cards.some((c,i)=>c.title!==expectedParticipantTitles[i]||c.src!==expectedParticipantFiles[i]||!c.alt||c.lazy!=="lazy"||!c.inside||!c.fits||Math.abs(c.photoRatio-1.5)>.03||c.fit!=="cover"||c.titleFont<17||c.copyFont<14))
  fails.push("ECOSYSTEM-PARTICIPANTS-01 responsive layout, card order or text clipping: "+JSON.stringify(participants));
  const services=diag.servicesLayout;
  if(!services.sheetLoaded||!services.revision?.startsWith("./styles.css?v=")||services.surface!=="rgb(244, 248, 254)"||services.gap!==(width<=700?12:16)||!services.headingAbsent||services.label!=="Servicios y aplicaciones DESSET"||services.columns!==(width<=700?1:2)||services.cards.length!==2||
   services.cards.map(c=>c.brand).join("|")!=="DESSET|DESSET prime"||
   services.cards.map(c=>c.service).join("|")!=="Comercio y delivery|Logística integral"||
   services.cards.some(c=>!c.visible||!c.inside||!c.fits||!c.centered||!c.primeStack||c.brandHeight<100||c.copyFont<15||c.copy.length<30)||
   services.cards.some(c=>c.borderWidth!=="1px"||c.radius!==12||c.shadow!=="none"||c.divider!=="1px"||!c.alignedCopy||c.bottomSpace>70||c.height>350)||
   services.cards[0].background!=="rgb(21, 81, 216)"||services.cards[0].borderColor!=="rgb(21, 81, 216)"||services.cards[0].descriptionColor!=="rgb(255, 255, 255)"||
   services.cards[1].background!=="rgb(255, 255, 255)"||services.cards[1].borderColor!=="rgb(216, 220, 226)"||services.cards[1].primeColor!=="rgb(21, 81, 216)"||services.cards[1].descriptionColor!=="rgb(65, 65, 65)"||
   Math.abs(services.cards[0].height-services.cards[1].height)>2||Math.abs(services.cards[0].dividerOffset-services.cards[1].dividerOffset)>2)
    fails.push("Two visible responsive service brands: "+JSON.stringify(services));
  if(diag.decorativeArrowCount!==0)fails.push("Decorative arrows remain in interactive controls");
 if(diag.footerLayout.columns!==2||diag.footerLayout.groups.join("|")!=="Empresa|Servicios|Ecosistema|Información institucional"||diag.footerLayout.links.length!==9||diag.footerLayout.links.some(x=>!x.inside||x.height<24)||diag.footerLayout.social.length!==5||diag.footerLayout.social.some(x=>x.width<44||x.height<44)||diag.footerLayout.center!=="center"||diag.footerLayout.copyright!=="© 2026 DESSET. Todos los derechos reservados.")fails.push("Corporate footer layout: "+JSON.stringify(diag.footerLayout));
 const partners=diag.partnerLayout;
 const cl=partners.closing;
 if(!cl.joined||cl.background!=="rgb(244, 248, 254)"||cl.headerBackground!=="rgba(0, 0, 0, 0)"||cl.align!=="center"||cl.words.join("|")!=="LAS BUENAS CONEXIONES|COMIENZAN AQUÍ"||cl.colors.join("|")!=="rgb(17, 17, 17)|rgb(21, 81, 216)"||!cl.decorAbsent||cl.cardFonts.some(f=>f<=cl.font))fails.push("CONTACT-03 unified closing hierarchy: "+JSON.stringify(cl));
  if(partners.columns!==(width<=700?1:2)||partners.gap!==(width<=700?12:16)||partners.cards.length!==2||
   partners.cards.map(c=>c.title).join("|")!=="Comercios|Repartidores"||
   partners.cards.map(c=>c.label).join("|")!=="Más información|Más información"||
   partners.cards.map(c=>c.accessibleLabel).join("|")!=="Más información para comercios|Más información para repartidores"||
   partners.cards.some(c=>!c.inside||!c.fit||c.href!==(c.title==="Comercios"?"./comercios.html":"./repartidores.html")||c.tap<48||c.icon!=="true"||c.border!=="1px"||c.radius!==20||c.shadow!=="none"||c.height>410||c.decoration!=="none"||c.buttonBg!==brandBlue||c.buttonInk!==pureWhite||Math.abs(c.buttonWidth-c.cardContentWidth)>2)||
   partners.cards[0].background!==pureWhite||partners.cards[1].background!=="rgb(255, 255, 255)"||
   Math.abs(partners.cards[0].height-partners.cards[1].height)>2)
    fails.push("Partner cards responsive parity: "+JSON.stringify(partners));
  if(width<=700){
   if(!diag.menuLabel?.startsWith("Menú"))fails.push("Mobile menu accessible name must include visible Menú label: "+diag.menuLabel);
  if(diag.typeSizes.heroLead<14||diag.typeSizes.serviceTitle<28||diag.typeSizes.storyTitle<(width<=480?20:17))fails.push("mobile content typography below release thresholds: "+JSON.stringify(diag.typeSizes));
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
 const heroQuality=await js(`(()=>({headline:document.querySelector("#hero-title")?.textContent?.replace(/\\s+/g," ").trim(),art:!!document.querySelector(".v4-motion-canvas"),oldDiagram:!!document.querySelector("#inicio .system-illustration"),brand:document.querySelector(".site-header .brand-mark")?.getAttribute("src"),flow:!!document.querySelector(".v4-flow-board"),unapprovedAutoPublish:!!document.querySelector("[data-deploy]")}))()`);
 if(!heroQuality.headline?.includes("AUMENTA EL VALOR")||!heroQuality.headline?.includes("A TU TIEMPO")||!heroQuality.art||heroQuality.oldDiagram||!heroQuality.flow||!heroQuality.brand?.includes("deliver-assets-mark.png")||heroQuality.unapprovedAutoPublish) report.failures.push("V4 visual contract failed: "+JSON.stringify(heroQuality));
 report.tests.push({name:"V4 motion/design contract",heroQuality});
 const heroPhoto=await js('(()=>{const x=document.querySelector("#inicio .prime-photo-image");const f=document.querySelector("#inicio .prime-photo-surface");return {loaded:!!x?.complete&&x.naturalWidth===1671&&x.naturalHeight===941,src:x?.getAttribute("src"),logo:document.querySelector(".site-header .brand-mark")?.getAttribute("src"),oldText:document.querySelector("#inicio")?.textContent?.includes("IDEAS EN ACCIÓN"),ratio:f?.getBoundingClientRect().width/f?.getBoundingClientRect().height}})()');
 if(!heroPhoto.loaded||!heroPhoto.src?.endsWith("desset-hero-entrega-dos-espejos.webp")||
    !heroPhoto.logo?.endsWith("deliver-assets-mark.png")||heroPhoto.oldText||heroPhoto.ratio<1.2||heroPhoto.ratio>2)
    report.failures.push("HERO-PHOTO-01 exact local render, original logo, conceptual disclosure failed: "+JSON.stringify(heroPhoto));
 report.tests.push({name:"HERO-PHOTO-01 exact local render, original logo, conceptual disclosure",heroPhoto});
 const roundedUI=await js('(()=>{const sels={hero:".v4-motion-canvas",cta:".hero-cta",card:".solutions-grid .service--main",board:".ecosystem-board",stage:".v5-city-stage",pitch:".business-pitch"};return {titles:[...document.querySelectorAll("h1,h2,h3")].map(e=>e.textContent.trim()),radii:Object.fromEntries(Object.entries(sels).map(([name,sel])=>[name,parseFloat(getComputedStyle(document.querySelector(sel)).borderTopLeftRadius)||0]))}})()');
 const decorDots=roundedUI.titles.filter(t=>t.endsWith("."));
 if(decorDots.length||Object.entries(roundedUI.radii).some(([,v])=>v<10))
   report.failures.push("V6.6 unexpected heading periods or missing rounded corners: "+JSON.stringify({decorDots,radii:roundedUI.radii}));
 report.tests.push({name:"V6.6 editorial punctuation and computed corner radii",roundedUI});

 const designSystem=await js('(()=>{const color=sel=>getComputedStyle(document.querySelector(sel)).backgroundColor;return {body:color("body"),contact:color(".contact"),feature:color(".solutions-grid .service--main"),brand:color(".business-pitch"),cssLoaded:[...document.styleSheets].some(s=>s.href?.endsWith("/styles-system.css")),steps:[...document.querySelectorAll(".motion-story-unit h3")].map(e=>e.textContent.trim())}})()');
 const expectedSteps=["PROVEEDORES","COMERCIOS","PERSONAS","OPERADORES LOGÍSTICOS"];
 if(!designSystem.cssLoaded||
    designSystem.body!=="rgb(247, 245, 238)"||
    designSystem.contact!=="rgba(0, 0, 0, 0)"||
    designSystem.feature!=="rgb(21, 81, 216)"||
    designSystem.brand!=="rgb(255, 255, 255)"||
    JSON.stringify(designSystem.steps)!==JSON.stringify(expectedSteps))
   report.failures.push("V6.7 computed 60-30-10 palette or four-participant narrative mismatch: "+JSON.stringify(designSystem));
 report.tests.push({name:"V6.7 palette 60-30-10 and editorial journey computed in browser",designSystem});
 const visual02=await js('(()=>{const q=s=>document.querySelector(s);const cs=s=>getComputedStyle(q(s));return {cssLoaded:[...document.styleSheets].some(x=>x.href?.endsWith("/styles-visual02.css")),heroPhoto:q("#inicio .prime-photo-image")?.getAttribute("src"),heroLogo:q(".site-header .brand-mark")?.getAttribute("src"),heroCTA:q("#inicio .hero-cta")?.getAttribute("href"),businessShadow:cs("#negocios .business-pitch").boxShadow,storyBorder:cs("#ecosistema .ecosystem-board").borderTopColor,serviceTop:cs("#soluciones .service--main").borderTopWidth,trustBg:cs("#vision").backgroundColor,mobileSafe:document.documentElement.scrollWidth<=document.documentElement.clientWidth+2}})()');
 if(!visual02.cssLoaded||!visual02.heroPhoto?.endsWith("desset-hero-entrega-dos-espejos.webp")||!visual02.heroLogo?.endsWith("deliver-assets-mark.png")||visual02.heroCTA!=="#contacto"||
   visual02.serviceTop!=="1px"||visual02.trustBg!=="rgb(244, 248, 254)"||!visual02.mobileSafe)
  report.failures.push("VISUAL-02 institutional editorial consistency regression: "+JSON.stringify(visual02));
 report.tests.push({name:"VISUAL-02 corporate style, approved hero and responsive safety",visual02});

 const appAccess=await js('(()=>{const s=document.querySelector("#soluciones");return {panel:!!document.querySelector("[data-service-access],.service-access,[data-service-status],[data-app-links]"),obsoleteText:/APLICACIONES DESSET|Acceso público no habilitado/.test(s.textContent),storeLinks:[...document.querySelectorAll("a[href]")].filter(a=>["play.google.com","apps.apple.com"].includes(new URL(a.href).hostname)).length,cards:s.querySelectorAll(".solutions-grid article.service").length}})()');
 if(appAccess.panel||appAccess.obsoleteText||appAccess.storeLinks!==0||appAccess.cards!==2)
   report.failures.push("Services must contain only the two brands, no app availability panel or store links: "+JSON.stringify(appAccess));
 report.tests.push({name:"Two service cards only; app availability panel absent and no unverified store links",appAccess});
 const kineticIntro=await js('(()=>({version:document.documentElement.dataset.kineticVersion,headlinePx:parseFloat(getComputedStyle(document.querySelector(".motion-headline")).fontSize),leadVisible:getComputedStyle(document.querySelector(".hero-lead")).visibility,graphic:document.querySelector(".site-header .brand-mark")?.getAttribute("src"),photoLoaded:document.querySelector("#inicio .prime-photo-image")?.complete}))()');
 if(kineticIntro.version!=="v45"||kineticIntro.headlinePx<50||kineticIntro.leadVisible!=="visible"||!kineticIntro.graphic?.includes("deliver-assets-mark.png")||!kineticIntro.photoLoaded)report.failures.push("V4.5 visible hero/photo and original brand failed: "+JSON.stringify(kineticIntro));
 report.tests.push({name:"V4.5 visible headline, photograph and original mark",kineticIntro});
 const anim01=await js('(()=>({noScan:!document.querySelector(".v5-stage-scan"),noDecor:!document.querySelector("#inicio .v4-shape, #inicio .v4-canvas-stamp, #inicio .v5-hero-refraction, #inicio .motion-brand-thread"),direction:document.documentElement.dataset.motionDirection}))()');
 if(!anim01.noScan||!anim01.noDecor||anim01.direction!=="editorial-cinematic-v1")
  report.failures.push("ANIM-01 obsolete ornament or arcade overlay detected: "+JSON.stringify(anim01));
 report.tests.push({name:"ANIM-01 no scanner, glint, cursor-game lens or bouncing hero",anim01});
 const anim02=await js('(()=>({photo:getComputedStyle(document.querySelector("#inicio .prime-photo-surface")).animationName,focus:getComputedStyle(document.querySelector("#inicio .prime-photo-image")).animationName,title:getComputedStyle(document.querySelector("#inicio .v4-headline-a .motion-line__inner")).animationName,cta:getComputedStyle(document.querySelector("#inicio .hero-actions")).animationName,chapters:document.documentElement.dataset.anim02,approvedSrc:document.querySelector("#inicio .prime-photo-image")?.getAttribute("src"),logo:document.querySelector(".brand-mark")?.getAttribute("src")}))()');
 if(anim02.photo!=="anim02-frame"||anim02.focus!=="anim02-focus"||anim02.title!=="anim02-type"||anim02.cta!=="anim02-enter"||anim02.chapters!=="cinematic-chapters"||
   !anim02.approvedSrc?.endsWith("desset-hero-entrega-dos-espejos.webp")||!anim02.logo?.endsWith("deliver-assets-mark.png"))
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
 
  const v5Cover=await js('(()=>({mode:document.documentElement.dataset.v5Mode,overlayAbsent:!document.querySelector(".v5-hero-refraction"),stage:!!document.querySelector(".v5-city-stage"),staticText:document.querySelector(".v6-static-fallback")?.textContent.includes("CENTRO"),noPoster:!document.querySelector(".v5-responsive-art,.v5-stage-render,.v5-stage-scan"),contactLight:!!document.querySelector(".v5-contact-light")}))()');
  if(v5Cover.mode!=="ready"||!v5Cover.overlayAbsent||!v5Cover.stage||!v5Cover.staticText||!v5Cover.noPoster||v5Cover.contactLight)report.failures.push("V5 image-free 3D section incomplete: "+JSON.stringify(v5Cover));
  report.tests.push({name:"V5 image-free accessible WebGL fallback",v5Cover});
 await js('document.querySelector(".v5-city-stage").scrollIntoView({block:"center",behavior:"instant"})');
 await sleep(580);
  const v5Stage=await js('(()=>{const e=document.querySelector(".v5-city-stage"),r=e.getBoundingClientRect(),w=e.querySelector(".v5-stage-world").getBoundingClientRect(),t=e.querySelector(".v6-static-fallback");return {visible:e.classList.contains("v5-visible"),fallback:!!t,sourceImage:!!e.querySelector(".v5-responsive-art,.v5-stage-render,.v5-stage-scan"),fallbackText:t?.textContent.includes("CENTRO"),worldWidth:w.width,worldHeight:w.height,obsoleteOverlay:!!e.querySelector(".v5-route-overlay"),left:r.left,right:r.right,viewport:document.documentElement.clientWidth,sceneDescription:e.getAttribute("aria-label"),noCaption:!e.querySelector("figcaption,.v5-stage-caption"),noBridge:!document.querySelector(".motion-story-bridge")}})()');
  if(!v5Stage.visible||!v5Stage.fallback||v5Stage.sourceImage||!v5Stage.fallbackText||v5Stage.worldWidth<300||v5Stage.worldHeight<200||v5Stage.obsoleteOverlay||v5Stage.left< -2||v5Stage.right>v5Stage.viewport+2||!v5Stage.sceneDescription?.includes("conceptual")||!v5Stage.noCaption||!v5Stage.noBridge)report.failures.push("V5 image-free desktop stage failed: "+JSON.stringify(v5Stage));
  report.tests.push({name:"V5 accessible image-free desktop stage",v5Stage});
 await capture("desktop-v5-scene-motion.png");
 await sleep(1750);
 await capture("desktop-v5-scene-final.png");
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
 if(rc.primaryHref!=="#contacto"||rc.obsoleteServices||rc.serviceCards!==2||!rc.contactHref.startsWith("https://www.instagram.com/")||rc.contactTarget!=="_blank"||rc.oldContact||rc.contactText!=="Instagram"||rc.headingCount!==1||!rc.removedResponsibility)report.failures.push("RC funnel and honesty contract failed: "+JSON.stringify(rc));
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
 for(const [w,h] of [[1920,1080],[1180,820],[1100,850],[1024,768],[861,900],[860,900],[768,900],[700,900],[699,900],[430,932],[390,844],[320,700]]){
  await viewport(w,h);
  if(w===1920||w===1024){
   await sleep(1450);
   await capture(w===1920?"desktop-1920-hero-fit.png":"desktop-1024-hero-fit.png");
  }
  if(w===390||w===320){
   // Simulate a script-unavailable page in the loaded DOM. This exercises
   // the exact no-JS CSS selector without needing a second browser session.
   const fallback=await js('(()=>{const root=document.documentElement;root.classList.remove("js-enabled");const nav=document.querySelector(".main-nav"),btn=document.querySelector(".menu-button"),header=document.querySelector(".site-header");const p={navDisplay:getComputedStyle(nav).display,menuDisplay:getComputedStyle(btn).display,headerHeight:header.getBoundingClientRect().height,links:[...nav.querySelectorAll("a")].map(a=>({text:a.textContent.trim(),height:a.getBoundingClientRect().height}))};root.classList.add("js-enabled");p.headerHeightAfter=header.getBoundingClientRect().height;return p})()');
   if(fallback.navDisplay!=="flex"||fallback.menuDisplay!=="none"||fallback.headerHeight<70||Math.abs(fallback.headerHeight-fallback.headerHeightAfter)>1||fallback.links.length<4||fallback.links.some(l=>l.height<42))
     report.failures.push("V6.8 no-JS mobile navigation failed: "+JSON.stringify(fallback));
   report.tests.push({name:"V6.8 resilient mobile navigation without JavaScript "+w,fallback});
   const radius=await js('(()=>({stage:parseFloat(getComputedStyle(document.querySelector(".v5-city-stage")).borderTopLeftRadius),pitch:parseFloat(getComputedStyle(document.querySelector(".business-pitch")).borderTopLeftRadius),screen:document.documentElement.clientWidth}))()');
   if(radius.stage<15||radius.pitch<17)report.failures.push("V6.6 mobile curves missing: "+JSON.stringify(radius));
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
   const socialMobile=await js('(()=>{const nav=document.querySelector(".footer-social"),v=document.documentElement.clientWidth;return {viewport:v,overflow:document.documentElement.scrollWidth>v+2,links:[...nav.querySelectorAll("a")].map(a=>({name:a.getAttribute("aria-label"),left:a.getBoundingClientRect().left,right:a.getBoundingClientRect().right,height:a.getBoundingClientRect().height}))}})()');
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
     if(leanMobile.children!==2||leanMobile.cols!==1||leanMobile.storyCards!==4||!leanMobile.empty3d||leanMobile.duplicates!==0||leanMobile.left< -2||leanMobile.journeyRight>leanMobile.viewport+2||leanMobile.titleRight>leanMobile.viewport+2||leanMobile.titleBottom>leanMobile.journeyTop+2||leanMobile.photos.some(w=>w<70)||leanMobile.scrollWidth>leanMobile.viewport+2||leanMobile.font<30)report.failures.push("PRIME-LAYOUT-01 mobile journey clips or overlaps heading: "+JSON.stringify(leanMobile));
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
   const details=await js('document.querySelector(".v4-architecture-details")?.open');
   if(details)report.failures.push("Technical roles should be collapsed by default");
   await js('document.querySelector(".v4-architecture-details summary").click()');
   const detailOpen=await js('(()=>{const d=document.querySelector(".v4-architecture-details");const cards=[...d.querySelectorAll(".role")];return {open:d.open,visible:cards.every(c=>c.getBoundingClientRect().height>40),roles:cards.length}})()');
   if(!detailOpen.open||!detailOpen.visible||detailOpen.roles!==4)report.failures.push("Technical roles accordion failed: "+JSON.stringify(detailOpen));
   await js('document.querySelector(".v4-architecture-details").scrollIntoView({block:"start",behavior:"instant"})');
   await sleep(100);
   const mobileDiagram=await js('(()=>{const im=document.querySelector(".v4-architecture-details picture img"),source=document.querySelector(".v4-architecture-details picture source"),r=im.getBoundingClientRect();return {src:im.currentSrc,naturalWidth:im.naturalWidth,naturalHeight:im.naturalHeight,renderWidth:r.width,renderHeight:r.height,source:source?.getAttribute("srcset")}})()');
   // Chromium may report SVG naturalWidth after responsive-density scaling.
   // The actual selected source, decoded aspect ratio and rendered CSS size
   // establish readability more reliably than fixed natural pixel dimensions.
   const aspect=mobileDiagram.naturalWidth/Math.max(1,mobileDiagram.naturalHeight);
   if(!mobileDiagram.src.endsWith("roles-geometry-mobile-es.svg")||mobileDiagram.renderWidth<220||mobileDiagram.renderHeight<220||Math.abs(aspect-360/392)>.035)
    report.failures.push("V6.8 mobile diagram must use legible art-directed SVG: "+JSON.stringify(mobileDiagram));
   report.tests.push({name:"V6.8 art-directed legible mobile SVG diagram",mobileDiagram});
   await capture("mobile-architecture-expanded.png");
   report.tests.push({name:"mobile technical detail expandable",detailOpen});
   await js('document.querySelector(".v4-architecture-details summary").click()');
   const detailsClosed=await js('document.querySelector(".v4-architecture-details").open === false');
   if(!detailsClosed)report.failures.push("Technical details remained expanded after mobile accordion test");
   report.tests.push({name:"Mobile technical accordion restored closed after testing",detailsClosed});
   await js('document.querySelector(".v5-city-stage").scrollIntoView({block:"center",behavior:"instant"})');
   await sleep(350);
    const v5Mobile=await js('(()=>{const e=document.querySelector(".v5-city-stage"),r=e.getBoundingClientRect(),w=e.querySelector(".v5-stage-world").getBoundingClientRect(),v=document.documentElement.clientWidth,t=e.querySelector(".v6-static-fallback");return {visible:e.classList.contains("v5-visible"),left:r.left,right:r.right,viewport:v,overflow:document.documentElement.scrollWidth>v+2,sceneDescription:e.getAttribute("aria-label"),noCaption:!e.querySelector("figcaption,.v5-stage-caption"),noBridge:!document.querySelector(".motion-story-bridge"),fallbackText:t?.textContent.includes("CENTRO"),noImage:!e.querySelector(".v5-responsive-art,.v5-stage-render,.v5-stage-scan"),ratio:+(w.height/w.width).toFixed(2)}})()');
    if(!v5Mobile.visible||v5Mobile.left< -2||v5Mobile.right>v5Mobile.viewport+2||v5Mobile.overflow||!v5Mobile.fallbackText||!v5Mobile.noImage||v5Mobile.ratio<1.4||!v5Mobile.sceneDescription?.includes("conceptual")||!v5Mobile.noCaption||!v5Mobile.noBridge)report.failures.push("V5 mobile 390 image-free fallback failed: "+JSON.stringify(v5Mobile));
    report.tests.push({name:"V5 mobile 390 image-free stage",v5Mobile});
   await capture("mobile-v5-scene.png");
   // Capture full page after activation without any poster image.
   const wholePageClosed=await js('(()=>({technical:document.querySelector(".v4-architecture-details").open,obsoleteServices:!!document.querySelector(".future-services")}))()');
   if(wholePageClosed.technical||wholePageClosed.obsoleteServices)report.failures.push("390px full-page screenshot would misrepresent default closed state: "+JSON.stringify(wholePageClosed));
   report.tests.push({name:"390px full-page capture: technical disclosure CLOSED, services visible",wholePageClosed});
   await capture("mobile-full.png",true);
  }
  if(w===320){
   const narrowContact=await js('(()=>{const a=document.querySelector(".footer-social a[data-footer-channel=Instagram]"),r=a.getBoundingClientRect(),v=document.documentElement.clientWidth;return {left:r.left,right:r.right,height:r.height,viewport:v}})()');
   if(narrowContact.left < -2||narrowContact.right>narrowContact.viewport+2||narrowContact.height<44)report.failures.push("320px contact button fail: "+JSON.stringify(narrowContact));
   await sleep(3200);
   await capture("mobile-320-final.png");
   
   await js('document.querySelector(".v5-city-stage").scrollIntoView({block:"center",behavior:"instant"})');
   await sleep(250);
    const v5Narrow=await js('(()=>{const e=document.querySelector(".v5-city-stage"),t=e.querySelector(".v6-static-fallback"),b=e.getBoundingClientRect(),v=document.documentElement.clientWidth,w=e.querySelector(".v5-stage-world").getBoundingClientRect();return {inside:b.left>=-2&&b.right<=v+2,ratio:+(w.height/w.width).toFixed(2),fallback:!!t&&t.textContent.includes("MUELLES"),noImage:!e.querySelector(".v5-responsive-art,.v5-stage-render,.v5-stage-scan")}})()');
    if(!v5Narrow.inside||v5Narrow.ratio<1.4||!v5Narrow.fallback||!v5Narrow.noImage)report.failures.push("V5 mobile 320 text fallback failed: "+JSON.stringify(v5Narrow));
    report.tests.push({name:"V5 mobile 320 image-free fallback",v5Narrow});
   await capture("mobile-320-v5-scene.png");
   // Capture full page after activation without any poster image.
   const narrowPageClosed=await js('(()=>({technical:document.querySelector(".v4-architecture-details").open,obsoleteServices:!!document.querySelector(".future-services")}))()');
   if(narrowPageClosed.technical||narrowPageClosed.obsoleteServices)report.failures.push("320px full-page screenshot would misrepresent default closed state: "+JSON.stringify(narrowPageClosed));
   report.tests.push({name:"320px full-page capture: technical disclosure CLOSED, services visible",narrowPageClosed});
   await capture("mobile-320-full.png",true);
  }
  if([1024,768,430,390,320].includes(w)){
   await js('document.querySelector("#soluciones").scrollIntoView({block:"center",behavior:"instant"})');
   await sleep(700);
   await capture("services-"+w+"px.png");
  }
 }
 const reduced=await viewport(390,844,true);
 const mobilePhoto=await js('(()=>{const x=document.querySelector("#inicio .prime-photo-image");return {src:x?.currentSrc,width:x?.naturalWidth,height:x?.naturalHeight,loaded:!!x?.complete}})()');
 if(!mobilePhoto.loaded||!mobilePhoto.src?.includes("desset-hero-entrega-mobile.webp")||mobilePhoto.width!==960)
  report.failures.push("HERO-PHOTO-01 mobile responsive photo not selected: "+JSON.stringify(mobilePhoto));
 report.tests.push({name:"HERO-PHOTO-01 60KB mobile WebP actually loaded",mobilePhoto});
 const reducedMode=await js("document.documentElement.dataset.motionSystem");
 if(reducedMode!=="reduced")report.failures.push("Motion fallback failed for reduced preference: "+String(reducedMode));
 const reducedAnimations=await js('(()=>({headline:document.querySelector(".motion-headline").textContent.trim(),cta:document.querySelector(".hero-cta").getAttribute("href"),closing:document.querySelector("#contact-title").textContent.trim(),noDecor:!document.querySelector("#inicio .v4-shape, #inicio .v4-canvas-stamp, #inicio .v5-hero-refraction, #inicio .motion-brand-thread")}))()');
 if(!reducedAnimations.noDecor||!reducedAnimations.headline.includes("AUMENTA EL VALOR")||reducedAnimations.cta!=="#contacto"||!reducedAnimations.closing.includes("CONEXIONES"))report.failures.push("V4.5 reduced motion/essential information failed: "+JSON.stringify(reducedAnimations));
 report.tests.push({name:"V4.5 full-fidelity reduced motion fallback",reducedAnimations});
 const anim02Reduced=await js('(()=>({photo:getComputedStyle(document.querySelector("#inicio .prime-photo-surface")).animationName,focus:getComputedStyle(document.querySelector("#inicio .prime-photo-image")).animationName,title:getComputedStyle(document.querySelector("#inicio .v4-headline-a .motion-line__inner")).animationName,cta:document.querySelector("#inicio .hero-cta")?.getAttribute("href"),captionAbsent:!document.querySelector("#inicio .prime-photo-caption")}))()');
 if(anim02Reduced.photo!=="none"||anim02Reduced.focus!=="none"||anim02Reduced.title!=="none"||anim02Reduced.cta!=="#contacto"||!anim02Reduced.captionAbsent)
  report.failures.push("ANIM-02 reduced-motion accessibility contract failed: "+JSON.stringify(anim02Reduced));
 report.tests.push({name:"ANIM-02 reduced motion leaves approved image and copy static",anim02Reduced});

  const v5Reduced=await js('(()=>{const e=document.querySelector(".v5-city-stage"),t=e.querySelector(".v6-static-fallback");return {mode:document.documentElement.dataset.v5Mode,light:document.querySelector(".v5-contact-light")?"present":"none",textVisible:!!t&&getComputedStyle(t).visibility!=="hidden",noImage:!e.querySelector("img,picture,.v5-responsive-art,.v5-stage-render,.v5-stage-scan"),gpuHidden:getComputedStyle(e.querySelector(".v6-three-mount")).display==="none",sceneDescription:e.getAttribute("aria-label"),noCaption:!document.querySelector(".v5-stage-caption"),noBridge:!document.querySelector(".motion-story-bridge")}})()');
  if(v5Reduced.mode!=="reduced"||v5Reduced.light!=="none"||!v5Reduced.textVisible||!v5Reduced.noImage||!v5Reduced.gpuHidden||!v5Reduced.sceneDescription?.includes("conceptual")||!v5Reduced.noCaption||!v5Reduced.noBridge)report.failures.push("V5 reduced-motion semantic text fallback failed: "+JSON.stringify(v5Reduced));
  report.tests.push({name:"V5 image-free reduced-motion fallback",v5Reduced});
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

 await js('document.querySelector(".v4-architecture-details summary").focus()');
 await pressKey("Enter","Enter",13);
 const detailsKeyboard=await js('(()=>{const d=document.querySelector(".v4-architecture-details"),e=d.querySelector("summary");return {open:d.open,focused:e===document.activeElement,focusVisible:e.matches(":focus-visible"),outlineWidth:getComputedStyle(e).outlineWidth}})()');
 if(!detailsKeyboard.open||!detailsKeyboard.focused||!detailsKeyboard.focusVisible||parseFloat(detailsKeyboard.outlineWidth)<2)
  report.failures.push("V5.4 keyboard accordion Enter or focus failed: "+JSON.stringify(detailsKeyboard));
 report.tests.push({name:"V5.4 native keyboard disclosure",detailsKeyboard});

 await call("Accessibility.enable");
 const tree=await call("Accessibility.getFullAXTree");
 const nodes=tree.result?.nodes||[];
 const headings=nodes.filter(n=>!n.ignored&&n.role?.value==="heading").map(n=>String(n.name?.value||"").trim());
 const accessible={nodeCount:nodes.length,headingCount:headings.length,
   hasHero:headings.some(n=>n.includes("AUMENTA EL VALOR")),hasContact:headings.some(n=>n.includes("CONEXIONES"))};
 if(!accessible.hasHero||!accessible.hasContact||accessible.headingCount<6)
  report.failures.push("V5.4 accessibility tree missing landmarks or headlines: "+JSON.stringify(accessible));
 report.tests.push({name:"V5.4 Chromium accessibility tree structural smoke",accessible});
 // Verify the exact deployable package as well as the working source, on all three device classes.
 const packaged=pathToFileURL(resolve("dist/index.html")).href;
 for(const [w,h] of [[1440,900],[768,900],[390,844]]){
  const result=await viewport(w,h,false,packaged);
  const source=report.viewports.find(v=>v.source==="source"&&v.width===w&&!v.reduce);
  const fingerprint=x=>JSON.stringify({surface:x.surface,gap:x.gap,columns:x.columns,revision:x.revision,cards:x.cards.map(c=>({brand:c.brand,background:c.background,borderColor:c.borderColor,borderWidth:c.borderWidth,radius:c.radius,divider:c.divider,primeColor:c.primeColor,centered:c.centered,descriptionColor:c.descriptionColor}))});
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

 // Validate the new company page in both source and packaged form.
 for(const root of ["","dist/"]){
  for(const [w,h] of [[1440,900],[768,900],[390,844],[320,700]]){
   await call("Emulation.setDeviceMetricsOverride",{width:w,height:h,deviceScaleFactor:1,mobile:w<=800});
   await call("Page.navigate",{url:pathToFileURL(resolve(root+"empresa.html")).href});
   await until(async()=>await js("document.readyState==='complete' && !!document.querySelector('.company-page')"),"company page render");
   await js('document.fonts.ready');
   const company=await js(`(()=>{const v=document.documentElement.clientWidth,n=document.querySelector(".corporate-footer");return {title:document.querySelector("h1").textContent,sections:[...document.querySelectorAll("main section")].map(e=>e.id),width:v,scroll:document.documentElement.scrollWidth,columns:getComputedStyle(n).gridTemplateColumns.trim().split(/\\s+/).length,links:[...n.querySelectorAll("a")].map(e=>({href:e.getAttribute("href"),inside:e.getBoundingClientRect().left>=0&&e.getBoundingClientRect().right<=v+2})),home:document.querySelector("header .brand").getAttribute("href"),robots:document.querySelector('meta[name="robots"]').content}})()`);
   if(company.title!=="Empresa"||company.sections.join("|")!=="quienes-somos|proposito|mision-vision|valores|areas|informacion-corporativa"||company.scroll>company.width+2||company.columns!==2||company.links.length!==9||company.links.some(x=>!x.inside)||company.home!=="./index.html"||company.robots!=="noindex,nofollow")report.failures.push("Company page "+root+w+": "+JSON.stringify(company));
   await capture((root?"dist-":"source-")+"company-"+w+"px.png",true);
   await js('document.querySelector(".site-footer").scrollIntoView({block:"end",behavior:"instant"})');
   await capture((root?"dist-":"source-")+"footer-"+w+"px.png");
   report.tests.push({name:"Company page "+root+w,company});
  }
 }

 // Audience pages must be responsive and available in source and dist.
 for(const page of ["comercios","repartidores"]){
 for(const root of ["","dist/"]){
  for(const [w,h] of [[1440,900],[768,900],[390,844],[320,700]]){
   await call("Emulation.setDeviceMetricsOverride",{width:w,height:h,deviceScaleFactor:1,mobile:w<=800});
   await call("Page.navigate",{url:pathToFileURL(resolve(root+page+".html")).href});
   await until(async()=>await js("document.readyState==='complete' && !!document.querySelector('.audience-page')"),"audience page render");
   await js('document.fonts.ready');
   const merchant=await js(`(()=>{const v=document.documentElement.clientWidth;return {title:document.querySelector("h1").textContent,sections:[...document.querySelectorAll("main section")].map(e=>e.id),width:v,scroll:document.documentElement.scrollWidth,home:document.querySelector("header .brand").getAttribute("href"),robots:document.querySelector('meta[name="robots"]').content,forms:document.querySelectorAll("form,input,iframe").length,channelLinks:document.querySelectorAll("#canales-oficiales a").length,cta:document.querySelector("#incorporacion a").getAttribute("href"),visible:[...document.querySelectorAll("main h1,main h2,main p,main li")].every(e=>(e.closest("details:not([open])")||e.getBoundingClientRect().width>0&&e.scrollWidth<=e.clientWidth+2))}})()`);
   if(merchant.title!==(page==="comercios"?"TU NEGOCIO, MÁS ALLÁ DE SUS PUERTAS":"CADA ENTREGA CONECTA UNA HISTORIA")||merchant.sections.join("|")!=="presentacion|beneficios|modelo|incorporacion|preguntas"||merchant.scroll>merchant.width+2||merchant.home!=="./index.html"||merchant.robots!=="noindex,nofollow"||merchant.forms||merchant.channelLinks!==5||merchant.cta!=="#canales-oficiales"||!merchant.visible)report.failures.push("MERCHANT-01 "+root+w+": "+JSON.stringify(merchant));
   await capture((root?"dist-":"source-")+page+"-"+w+"px.png",true);
   report.tests.push({name:"Audience page "+page+" "+root+w,merchant});
  }
 }
 }
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
