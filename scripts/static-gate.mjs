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
const pageNames=["index.html","empresa.html","comercios.html","repartidores.html","prime.html","contacto.html","confianza.html","noticias.html","talento.html","en.html","registro-comercios.html","incorporacion-comercios.html","registro-repartidores.html","incorporacion-repartidores.html","capacitacion-repartidores.html","aplicaciones.html","aplicaciones-clientes.html","aplicaciones-comercios.html","aplicaciones-repartidores.html"];
const pages=pageNames.map(name=>[name,read(name)]);
const headers=read("_headers");
const js=["scripts/app.js","scripts/motion.js","scripts/v5-cinematic.js","scripts/service-state.js"].map(read);
const styles=["styles-typography.css","styles.css","styles-v5.css","styles-system.css","styles-hero-photo.css","styles-visual02.css","styles-audiences.css","styles-prime.css","styles-contact.css","styles-trust.css","styles-news.css","styles-careers.css","styles-onboarding.css","styles-applications.css"].map(read);
const issues=[],warnings=[];
const assert=(ok,label)=>{if(!ok)issues.push(label)};
const localSet=new Set();
const mainCss=readFileSync(resolve(root,"styles.css"));
const cssRevision=createHash("sha1").update("blob "+mainCss.length+"\0").update(mainCss).digest("hex");
for(const [page,doc] of pages){
 assert(doc.includes('href="./styles.css?v='+cssRevision+'"'),page+": Main stylesheet cache revision does not match source bytes");
 for(const tag of doc.match(/<(?:script|link|img|source)\b[^>]*>/gi)||[]){
  const attrs=[...tag.matchAll(/\b(?:src|href|srcset)="([^"]+)"/g)].map(m=>m[1]);
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
 assert(!/<(?:form|iframe|video)\b/i.test(doc),page+": Unauthorized form/iframe/video");
 assert(!/(?:\s)on[a-z]+\s*=/i.test(doc),page+": Inline event attribute detected");
 if(["registro-comercios.html","registro-repartidores.html"].includes(page))assert(!/<(?:fieldset|input|select|textarea|button)\b/i.test(doc),page+": Data-entry control in informational preparation");
 if(appPages.includes(page.replace(/\.html$/,""))){try{assertClosedAppPage(doc,page.replace(/\.html$/,""));}catch(e){issues.push(page+": "+e.message);}}else if(page!=="index.html"&&!institutionalPages.includes(page.replace(/\.html$/,"")))assert(!/<script\b/i.test(doc),page+": Unexpected script on institutional page");
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
const budget={html_bytes:35000,typography_css_bytes:2800,v5_css_bytes:16000,system_css_bytes:10000,hero_css_bytes:9500,visual02_css_bytes:8200,audiences_css_bytes:4500,prime_css_bytes:4500,contact_css_bytes:3000,trust_css_bytes:4000,news_css_bytes:4500,careers_css_bytes:3000,onboarding_css_bytes:4000,applications_css_bytes:5000,hero_webp_bytes:210000,mobile_hero_webp_bytes:85000};
const sizes={html_bytes:statSync(resolve(root,"index.html")).size,
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
 onboarding_css_bytes:statSync(resolve(root,"styles-onboarding.css")).size,
 hero_webp_bytes:statSync(resolve(root,"assets/desset-hero-entrega-dos-espejos.webp")).size,
 mobile_hero_webp_bytes:statSync(resolve(root,"assets/desset-hero-entrega-mobile.webp")).size};
for(const [name,size]of Object.entries(sizes))assert(size<=budget[name],name+" exceeds budget");
const report={schema:"desset-v5.3-static-gate-v1",checks:"resource allowlist; CSP; no external JS/CSS; noindex; anchors; no deploy; byte budgets",
 pages_checked:pageNames,assets_checked:[...localSet].sort(),sizes,warnings,issues,
 limitations:"Source scanner only; not a replacement for SAST, SCA, penetration testing or HTTP production validation."};
mkdirSync(resolve(root,"reports/quality"),{recursive:true});
writeFileSync(resolve(root,"reports/quality/static.json"),JSON.stringify(report,null,2)+"\n");
console.log("DESSET static/source gate "+(issues.length?"FAIL":"PASS")+": "+pageNames.length+" pages, "+localSet.size+" assets, "+issues.length+" issues.");
if(issues.length){console.error(issues.join("\n"));process.exitCode=1}
