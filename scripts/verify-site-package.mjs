import {appPages,assertClosedDistribution,assertClosedAppPage} from "./app-distribution-contract.mjs";
/** Verify the packaged DESSET Prime website, not only source files.
 * Strict offline integrity and negative-control checks before any preview.
 */
import {readFile,readdir,stat} from "node:fs/promises";
import {createHash} from "node:crypto";
import {resolve,relative,sep} from "node:path";
import {fileURLToPath} from "node:url";

const base=resolve(fileURLToPath(new URL("../",import.meta.url)));
const dist=resolve(base,"dist");
const check=(ok,message)=>{if(!ok)throw Error("Packaged website NOT VERIFIED: "+message)};
const manifest=JSON.parse(await readFile(resolve(dist,"site-manifest.json"),"utf8"));
check(manifest.schema==="desset-prime-static-web-package-v1","unknown manifest");
check(manifest.noindex===true&&manifest.domain==="none","unapproved publication metadata");
check(manifest.files.length===68,"unexpected file count");
const expected=new Set(manifest.files.map(x=>x.path));
check(expected.size===manifest.files.length,"duplicate entries");
let total=0;
for(const entry of manifest.files){
 check(!entry.path.includes("..")&&!entry.path.startsWith("/"),"unsafe path "+entry.path);
 const abs=resolve(dist,entry.path);
 check(abs.startsWith(dist+sep),"path escapes dist: "+entry.path);
 const bytes=await readFile(abs);
 const digest=createHash("sha256").update(bytes).digest("hex");
 check(digest===entry.sha256&&entry.bytes===bytes.length,"sha256 mismatch "+entry.path);
 total+=bytes.length;
}
check(total===manifest.totalBytes,"package size mismatch");
const html=await readFile(resolve(dist,"index.html"),"utf8");
const company=await readFile(resolve(dist,"empresa.html"),"utf8");
const rider=await readFile(resolve(dist,"repartidores.html"),"utf8");
check(expected.has("repartidores.html")&&rider.includes('name="robots" content="noindex,nofollow"'),"Rider page absent or indexing changed");
const prime=await readFile(resolve(dist,"prime.html"),"utf8");
check(expected.has("prime.html")&&prime.includes('name="robots" content="noindex,nofollow"'),"Prime page absent or indexing changed");
const contact=await readFile(resolve(dist,"contacto.html"),"utf8");
check(expected.has("contacto.html")&&contact.includes('name="robots" content="noindex,nofollow"'),"Contact page absent or indexing changed");
const trust=await readFile(resolve(dist,"confianza.html"),"utf8");
check(expected.has("confianza.html")&&trust.includes('name="robots" content="noindex,nofollow"'),"Trust page absent or indexing changed");
const news=await readFile(resolve(dist,"noticias.html"),"utf8");
check(expected.has("noticias.html")&&news.includes('name="robots" content="noindex,nofollow"'),"News page absent or indexing changed");
const careers=await readFile(resolve(dist,"talento.html"),"utf8");
check(expected.has("talento.html")&&careers.includes('name="robots" content="noindex,nofollow"'),"Careers page absent or indexing changed");
const english=await readFile(resolve(dist,"en.html"),"utf8");
check(expected.has("en.html")&&english.includes('name="robots" content="noindex,nofollow"'),"English page absent or indexing changed");
const registration=await readFile(resolve(dist,"registro-comercios.html"),"utf8");
check(expected.has("registro-comercios.html")&&registration.includes('name="robots" content="noindex,nofollow"'),"Registration page absent or indexing changed");
const guide=await readFile(resolve(dist,"incorporacion-comercios.html"),"utf8");
check(expected.has("incorporacion-comercios.html")&&guide.includes('name="robots" content="noindex,nofollow"'),"Guide page absent or indexing changed");
for(const name of ["registro-repartidores","incorporacion-repartidores","capacitacion-repartidores"]){const path=name+".html",p=await readFile(resolve(dist,path),"utf8");check(expected.has(path)&&p.includes('name="robots" content="noindex,nofollow"')&&p.includes('href="./styles-onboarding.css"')&&p.includes("form-action 'none'"),"Rider onboarding missing or unsafe: "+name);}
const merchant=await readFile(resolve(dist,"comercios.html"),"utf8");
check(expected.has("comercios.html")&&merchant.includes('name="robots" content="noindex,nofollow"'),"Merchant page absent or indexing changed");
check(expected.has("empresa.html")&&company.includes('name="robots" content="noindex,nofollow"'),"Company page absent or indexing changed");
const mainCss=await readFile(resolve(dist,"styles.css"));
const cssRevision=createHash("sha1").update("blob "+mainCss.length+"\0").update(mainCss).digest("hex");
check([html,company,merchant,rider,prime,contact].every(p=>p.includes('href="./styles.css?v='+cssRevision+'"')),"Packaged HTML and main stylesheet cache revision mismatch");
const loader=await readFile(resolve(dist,"scripts/v5-cinematic.js"),"utf8");
const vision=html.split('<section class="statement" id="vision"')[1]?.split("</section>")[0]||"";
const scene=html.split('<section class="ecosystem" id="ecosistema"')[1]?.split("</section>")[0]||"";
check(vision.includes('class="v4-flow motion-story statement-journey"')&&
 (vision.match(/class="motion-story-unit motion-story-unit--/g)||[]).length===4&&
 !scene.includes("motion-story-unit")&&!scene.includes('class="v6-three-mount"')&&prime.includes('class="v6-three-mount"'),
 "PRIME-LAYOUT-01 include four participant photos without duplicating or damaging 3D scene");
check(html.includes('class="service-body" id="ecosistema"')&&!html.includes('<section class="ecosystem"')&&!html.includes('class="prime-3d-heading"')&&!html.includes("roles-geometry-")&&!html.includes('class="v4-architecture-details"')&&!html.includes('class="ecosystem-board')&&
 !html.includes('data-v64-tour-launch'),"3D section landmark or duplicate hero CTA regression");
check(!html.includes('class="v6-three-mount"')&&prime.includes('class="v63-tour"')&&prime.includes('class="v6-three-mount"'),"3D tour must be mounted only in Prime");
check(html.includes('name="robots" content="noindex,nofollow"'),"noindex absent");
check(loader.includes('activationObserver.observe(stage)')&&loader.includes('threeStart?.addEventListener("click",loadThree)')&&
 loader.includes('./assets/v6-three.bundle.js'),"3D viewport activation or manual fallback not connected");
for(const name of ["commerce","courier","destination"]){
 const path="assets/v62-"+name+".glb";
 check(expected.has(path),"GLB missing "+name);
 const bytes=await readFile(resolve(dist,path));
 check(bytes.toString("ascii",0,4)==="glTF"&&bytes.readUInt32LE(4)===2,"invalid GLB "+name);
}
check(expected.has("assets/comercios-hero-minimercado.webp"),"Merchant hero photo missing");
check(expected.has("assets/talento-cultura.webp")&&careers.includes('src="./assets/talento-cultura.webp"'),"Careers hero photo missing");
check(expected.has("assets/talento-equipo.webp")&&html.includes('src="./assets/talento-equipo.webp"')&&!html.includes('src="./assets/talento-cultura.webp"'),"Homepage talent photo missing or incorrect");
check(expected.has("assets/v6-three.bundle.js"),"Three.js bundle is missing");
check(expected.has("styles-typography.css")&&html.includes('href="./styles-typography.css"'),"Locally hosted type system missing");
check(expected.has("styles-audiences.css")&&[merchant,rider].every(p=>p.includes('href="./styles-audiences.css"'))&&!html.includes("styles-audiences.css")&&!company.includes("styles-audiences.css"),"Audience styles must remain isolated");
check(expected.has("styles-prime.css")&&prime.includes('href="./styles-prime.css"')&&[html,company,merchant,rider].every(p=>!p.includes("styles-prime.css")),"Prime styles must remain isolated");
check(expected.has("styles-contact.css")&&contact.includes('href="./styles-contact.css"')&&[html,company,merchant,rider,prime].every(p=>!p.includes("styles-contact.css")),"Contact styles must remain isolated");
check(expected.has("styles-trust.css")&&trust.includes('href="./styles-trust.css"')&&[html,company,merchant,rider,prime,contact].every(p=>!p.includes("styles-trust.css")),"Trust styles must remain isolated");
check(expected.has("styles-news.css")&&news.includes('href="./styles-news.css"')&&[html,company,merchant,rider,prime,contact,trust].every(p=>!p.includes("styles-news.css")),"News styles must remain isolated");
check(expected.has("styles-careers.css")&&careers.includes('href="./styles-careers.css"')&&[html,company,merchant,rider,prime,contact,trust,news].every(p=>!p.includes("styles-careers.css")),"Careers styles must remain isolated");
const typography=await readFile(resolve(dist,"styles-typography.css"),"utf8");
for(const file of ["inter-latin-variable.woff2","plus-jakarta-sans-latin-variable.woff2"]){
 const path="fonts/"+file;
 check(expected.has(path)&&typography.includes("./"+path),"Local WOFF2 unlinked: "+path);
 check((await readFile(resolve(dist,path))).subarray(0,4).toString()==="wOF2","Invalid WOFF2 font: "+path);
}
for(const file of ["LICENSE-Inter-OFL.txt","LICENSE-Plus-Jakarta-Sans-OFL.txt"]){
 const path="fonts/"+file;
 check(expected.has(path),"Open Font License notice missing: "+path);
 check((await readFile(resolve(dist,path),"utf8")).includes("SIL OPEN FONT LICENSE Version 1.1"),"Malformed OFL license: "+path);
}
check(html.includes('rel="preload" href="./fonts/inter-latin-variable.woff2"')&&html.includes('rel="preload" href="./fonts/plus-jakarta-sans-latin-variable.woff2"'),"Local font preload missing");
check(expected.has("styles-system.css")&&html.includes('href="./styles-system.css"'),"60/30/10 design CSS not packaged");
check(expected.has("styles-hero-photo.css")&&html.includes('href="./styles-hero-photo.css"'),"Photographic stylesheet missing");
check(expected.has("styles-visual02.css")&&html.includes('href="./styles-visual02.css"'),"VISUAL-02 editorial stylesheet missing");
check(expected.has("assets/desset-hero-entrega-dos-espejos.webp")&&html.includes('src="./assets/desset-hero-entrega-dos-espejos.webp"'),"Approved photographic render is not packaged");
check(expected.has("assets/desset-hero-entrega-mobile.webp")&&html.includes('srcset="./assets/desset-hero-entrega-mobile.webp"'),"Mobile photographic LCP asset missing");
check(!html.includes("IDEAS</span>")&&!html.includes("ACCIÓN</span>"),"Unrelated old slogan was left");
check(expected.has("scripts/service-state.js")&&html.includes('src="./scripts/service-state.js"'),"Institutional availability module not packaged");
for(const name of appPages){const path=name+".html";check(expected.has(path),"Missing app directory page");assertClosedAppPage(await readFile(resolve(dist,path),"utf8"),name);}
check(expected.has("styles-applications.css"),"Missing app directory stylesheet");
const availability=await readFile(resolve(dist,"scripts/service-state.js"),"utf8");
assertClosedDistribution(availability);
check(!/data-service-access|data-service-status|data-app-links|APLICACIONES DESSET|Acceso público no habilitado/.test(html),"Obsolete application availability panel in packaged site");
check(!/<a\b[^>]*href=["']https?:\/\/(?:play\.google\.com|apps\.apple\.com)(?:[\/:?#"']|$)/i.test(html),"Unapproved application store link in packaged site");
check([...expected].every(path=>!/^assets\/roles-geometry-(?:v2|es|mobile-es)\.svg$/.test(path)),"Retired role diagrams must be source-only");
check(![...expected].some(x=>x.endsWith(".md")||x.includes("workflow")||x.includes("package")||x.includes("node_modules")), "development files in static site");
async function inventory(path=""){
 const entries=await readdir(resolve(dist,path),{withFileTypes:true});
 const found=[];
 for(const entry of entries){
  const rel=path?path+"/"+entry.name:entry.name;
  if(entry.isDirectory())found.push(...await inventory(rel));
  else if(entry.isFile())found.push(rel);
  else throw Error("Unexpected symlink or nonfile in web package: "+rel);
 }
 return found;
}
const actual=await inventory();
check(actual.length===expected.size+1,"unexpected file/s in packed site");
check(actual.every(x=>x==="site-manifest.json"||expected.has(x)),"unknown web package content");
console.log("DESSET Prime built website PASS: "+expected.size+" SHA-256-verified files (not cryptographically signed), "+total+" bytes; Three.js and three GLB ready, viewport-activated WebGL2 and local guided tour connected");

check(expected.has("styles-onboarding.css")&&[registration,guide].every(p=>p.includes('href="./styles-onboarding.css"')),"Onboarding stylesheet required");
