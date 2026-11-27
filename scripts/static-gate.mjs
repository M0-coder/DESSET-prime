import {companyFiles,companyCss} from "./company-routes.mjs";
import {appPages,assertClosedDistribution,assertClosedAppPage} from "./app-distribution-contract.mjs";
import {institutionalPages,assertInstitutionalNavigation} from "./institutional-navigation-contract.mjs";
/** Static source and asset integrity scanner: deliberately not a full SAST/SCA tool. */
import {readFileSync,existsSync,statSync,mkdirSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {createHash} from "node:crypto";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("../",import.meta.url)));
const read=p=>readFileSync(resolve(root,p),"utf8");
const html=read("index.html");
const pageNames=["index.html","empresa.html","comercios.html","repartidores.html","prime.html","contacto.html","confianza.html","noticias.html","talento.html","en.html","registro-comercios.html","incorporacion-comercios.html","registro-repartidores.html","incorporacion-repartidores.html","capacitacion-repartidores.html","aplicaciones.html","aplicaciones-clientes.html","aplicaciones-comercios.html","aplicaciones-repartidores.html",...companyFiles];
const pages=pageNames.map(name=>[name,read(name)]);
const headers=read("_headers");
const js=["scripts/app.js","scripts/motion.js","scripts/v5-cinematic.js","scripts/service-state.js","scripts/hero-editorial.js"].map(read);
const styles=["styles-typography.css","styles.css","styles-v5.css","styles-system.css","styles-hero-photo.css","styles-hero-editorial.css","styles-visual02.css","styles-service-video.css","styles-audiences.css","styles-prime.css","styles-contact.css","styles-trust.css","styles-news.css","styles-careers.css","styles-onboarding.css","styles-applications.css",companyCss].map(read);
const issues=[],warnings=[];
const assert=(ok,label)=>{if(!ok)issues.push(label)};
const localSet=new Set();
const mainCss=readFileSync(resolve(root,"styles.css"));
const cssRevision=createHash("sha1").update("blob "+mainCss.length+"\0").update(mainCss).digest("hex");
for(const [page,doc] of pages){
 assert(doc.includes('href="./styles.css?v='+cssRevision+'"'),page+": Main stylesheet cache revision does not match source bytes");
 for(const tag of doc.match(/<(?:script|link|img|source|video)\b[^>]*>/gi)||[]){
  const attrs=[...tag.matchAll(/\b(?:src|href|srcset|poster|data-src)="([^"]+)"/g)].map(m=>m[1]);
  for(const val of attrs){
   if(!val.startsWith("./")){issues.push(page+": Nonlocal DOM resource "+val);continue}
   const raw=val.slice(2);
   const filename=raw==="styles.css?v="+cssRevision?"styles.css":raw;
   if(filename.includes("..")||filename.startsWith("/")||filename.includes("\\")){issues.push(page+": Unsafe asset path "+filename);continue}
   const full=resolve(root,filename);
   assert(existsSync(full),page+": Referenced asset missing: "+filename);
   if(existsSync(full))localSet.add(filename);
  }
 }
 for(const url of [...doc.matchAll(/href="#([^"]+)"/g)].map(m=>m[1]))
  assert(doc.includes('id="'+url+'"'),page+": Broken in-page navigation anchor #"+url);
 assert(/name="robots" content="noindex,nofollow"/.test(doc),page+": Missing noindex");
 const csp=doc.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/i)?.[1]||"";
 for(const directive of ["default-src 'self'","script-src 'self'","object-src 'none'","base-uri 'none'","form-action 'none'"])
  assert(csp.split(";").map(x=>x.trim()).includes(directive),page+": Missing or weakened local CSP directive "+directive);
 assert(!/<(?:form|iframe)\b/i.test(doc),page+": Unauthorized form/iframe");
 const videoTags=[...doc.matchAll(/<video\b[^>]*>/gi)].map(m=>m[0]);
 if(page==="index.html"){const section=doc.match(/<section class="solutions" id="soluciones"[\s\S]*?<\/section>/)?.[0]||"";assert(videoTags.length===3&&videoTags.some(tag=>tag.includes('id="desset-editorial-video"')&&tag.includes('data-src="./assets/desset-hero-editorial.mp4"')&&tag.includes('muted loop playsinline preload="none"')&&!/\s(?:src|autoplay)\b/i.test(tag))&&["desset","prime"].every(n=>videoTags.some(tag=>section.includes(tag)&&tag.includes('data-src="./assets/servicio-'+n+'.mp4"')&&tag.includes('poster="./assets/servicio-'+n+'-poster.webp"')&&tag.includes('muted loop playsinline preload="none"')&&!/\s(?:src|autoplay)\b/i.test(tag))),"VIDEO-01: only the three approved deferred local videos");}else if(page==="aplicaciones.html"){const hero=doc.match(/<section class="apps-hero apps-hero--video">[\s\S]*?<\/section>/)?.[0]||"";assert(videoTags.length===1&&hero.includes(videoTags[0])&&videoTags[0].includes('data-src="./assets/aplicaciones-hero.mp4"')&&videoTags[0].includes('muted loop playsinline preload="none"')&&!/\s(?:src|autoplay|controls|poster)\b/i.test(videoTags[0]),"APP-HERO-VIDEO-01: approved local deferred video only");}else assert(videoTags.length===0,page+": Unauthorized video");
 assert(!/(?:\s)on[a-z]+\s*=/i.test(doc),page+": Inline event attribute detected");
 if(["registro-comercios.html","registro-repartidores.html"].includes(page))for(const field of doc.matchAll(/<(?:input|select|textarea|button)\b[^>]*>/gi))assert(/\bdisabled\b/.test(field[0]),page+": Enabled data entry in inactive preview");
 if(appPages.includes(page.replace(/\.html$/,""))){try{assertClosedAppPage(doc,page.replace(/\.html$/,""));}catch(e){issues.push(page+": "+e.message);}}else if(page==="prime.html"){const scripts=[...doc.matchAll(/<script\b[^>]*src="([^"]+)"[^>]*>/gi)].map(m=>m[1]);assert(scripts.length===1&&scripts[0]==="./scripts/v5-cinematic.js",page+": Unexpected Prime script");}else if(page!=="index.html"&&!institutionalPages.includes(page.replace(/\.html$/,"")))assert(!/<script\b/i.test(doc),page+": Unexpected script on institutional page");
 if(institutionalPages.includes(page.replace(/\.html$/,""))){try{assertInstitutionalNavigation(html,doc,page.replace(/\.html$/,""));}catch(e){issues.push(page+": "+e.message);}}
 assert(Buffer.byteLength(doc,"utf8")<=35000,page+": HTML byte budget exceeded");
}
assert(/Content-Security-Policy/.test(headers),"Missing published-host CSP template");
assert(/default-src 'self'/.test(headers)&&/script-src 'self'/.test(headers)&&/object-src 'none'/.test(headers),"CSP too relaxed");
assert(/frame-ancestors 'none'/.test(headers),"Missing frame-ancestors gate");
for(const [i,s] of js.entries()){
 assert(!/\b(?:eval|new Function)\s*\(/.test(s),"Unsafe eval in scripts index "+i);
 assert(!/\b(?:fetch|WebSocket|XMLHttpRequest|sendBeacon)\s*\(/.test(s),"Unauthorized network call in scripts index "+i);
}
assert(styles.every(s=>!/@import\b|url\(\s*['"]?https?:/i.test(s)),"Remote CSS dependency");
assert(!/\b(?:pages:\s*write|id-token:\s*write)\b/.test(read(".github/workflows/preview-checks.yml")),"CI write token permission");
const budget={editorial_css_bytes:6500,editorial_js_bytes:3500,editorial_video_bytes:7000000,editorial_poster_bytes:70000,company_css_bytes:6500,html_bytes:35000,typography_css_bytes:2800,v5_css_bytes:16000,system_css_bytes:14000,hero_css_bytes:17000,visual02_css_bytes:8200,audiences_css_bytes:18000,prime_css_bytes:4500,contact_css_bytes:3000,trust_css_bytes:4000,news_css_bytes:4500,careers_css_bytes:6500,onboarding_css_bytes:4000,applications_css_bytes:5000,applications_hero_video_bytes:75000,service_video_css_bytes:4500,service_desset_video_bytes:1200000,service_prime_video_bytes:1650000,service_desset_poster_bytes:20000,service_prime_poster_bytes:50000,hero_webp_bytes:210000,mobile_hero_webp_bytes:85000,merchant_hero_webp_bytes:210000};
const sizes={editorial_css_bytes:statSync(resolve(root,"styles-hero-editorial.css")).size,editorial_js_bytes:statSync(resolve(root,"scripts/hero-editorial.js")).size,editorial_video_bytes:statSync(resolve(root,"assets/desset-hero-editorial.mp4")).size,editorial_poster_bytes:statSync(resolve(root,"assets/desset-hero-editorial-poster.webp")).size,company_css_bytes:statSync(resolve(root,companyCss)).size,html_bytes:statSync(resolve(root,"index.html")).size,
 typography_css_bytes:statSync(resolve(root,"styles-typography.css")).size,
 v5_css_bytes:statSync(resolve(root,"styles-v5.css")).size,
 system_css_bytes:statSync(resolve(root,"styles-system.css")).size,
 hero_css_bytes:statSync(resolve(root,"styles-hero-photo.css")).size,
 visual02_css_bytes:statSync(resolve(root,"styles-visual02.css")).size,
 audiences_css_bytes:statSync(resolve(root,"styles-audiences.css")).size,
 prime_css_bytes:statSync(resolve(root,"styles-prime.css")).size,
 contact_css_bytes:statSync(resolve(root,"styles-contact.css")).size,
 trust_css_bytes:statSync(resolve(root,"styles-trust.css")).size,
 news_css_bytes:statSync(resolve(root,"styles-news.css")).size,
 careers_css_bytes:statSync(resolve(root,"styles-careers.css")).size,
 applications_css_bytes:statSync(resolve(root,"styles-applications.css")).size,
 applications_hero_video_bytes:statSync(resolve(root,"assets/aplicaciones-hero.mp4")).size,
 onboarding_css_bytes:statSync(resolve(root,"styles-onboarding.css")).size,
 service_video_css_bytes:statSync(resolve(root,"styles-service-video.css")).size,
 service_desset_video_bytes:statSync(resolve(root,"assets/servicio-desset.mp4")).size,
 service_prime_video_bytes:statSync(resolve(root,"assets/servicio-prime.mp4")).size,
 service_desset_poster_bytes:statSync(resolve(root,"assets/servicio-desset-poster.webp")).size,
 service_prime_poster_bytes:statSync(resolve(root,"assets/servicio-prime-poster.webp")).size,
 hero_webp_bytes:statSync(resolve(root,"assets/desset-hero-entrega-dos-espejos.webp")).size,
 merchant_hero_webp_bytes:statSync(resolve(root,"assets/comercios-hero-minimercado.webp")).size,
 mobile_hero_webp_bytes:statSync(resolve(root,"assets/desset-hero-entrega-mobile.webp")).size};
for(const [name,size]of Object.entries(sizes))assert(size<=budget[name],name+" exceeds budget");
const report={schema:"desset-v5.3-static-gate-v1",checks:"resource allowlist; CSP; no external JS/CSS; noindex; anchors; no deploy; byte budgets",
 pages_checked:pageNames,assets_checked:[...localSet].sort(),sizes,warnings,issues,
 limitations:"Source scanner only; not a replacement for SAST, SCA, penetration testing or HTTP production validation."};
mkdirSync(resolve(root,"reports/quality"),{recursive:true});
writeFileSync(resolve(root,"reports/quality/static.json"),JSON.stringify(report,null,2)+"\n");
console.log("DESSET static/source gate "+(issues.length?"FAIL":"PASS")+": "+pageNames.length+" pages, "+localSet.size+" assets, "+issues.length+" issues.");
if(issues.length){console.error(issues.join("\n"));process.exitCode=1}
