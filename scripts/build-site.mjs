import {appPages,assertClosedDistribution,assertClosedAppPage} from "./app-distribution-contract.mjs";
/** DESSET Prime: deterministic, self-contained WEBSITE package from the actual page.
 * Zero network calls, production deployment, DNS, CI tokens or source mutation.
 * Build Three.js/GLB first: npm ci && npm run build:site.
 */
import {readdir,readFile,stat,mkdir,cp,rm,writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";
import {resolve,relative,sep,extname} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(fileURLToPath(new URL("../",import.meta.url)));
const target=resolve(root,"dist");
const assets=await readdir(resolve(root,"assets"));
const allowStatic=assets.filter(name=>name!=="roles-geometry-v2.svg"&&/^[a-z0-9-]+\.(?:png|svg|webp)$/.test(name))
 .map(name=>"assets/"+name);
const compiled=["assets/v6-three.bundle.js",
 "assets/v62-commerce.glb","assets/v62-courier.glb","assets/v62-destination.glb"];
const typefaces=["fonts/inter-latin-variable.woff2","fonts/plus-jakarta-sans-latin-variable.woff2",
 "fonts/LICENSE-Inter-OFL.txt","fonts/LICENSE-Plus-Jakarta-Sans-OFL.txt"];
const files=[
 "index.html","empresa.html","comercios.html","repartidores.html","prime.html","contacto.html","confianza.html","noticias.html","talento.html","en.html","registro-comercios.html","incorporacion-comercios.html","registro-repartidores.html","incorporacion-repartidores.html","capacitacion-repartidores.html","aplicaciones.html","aplicaciones-clientes.html","aplicaciones-comercios.html","aplicaciones-repartidores.html","styles.css","styles-onboarding.css","styles-applications.css","styles-v5.css","styles-system.css","styles-hero-photo.css","styles-visual02.css","styles-typography.css","styles-audiences.css","styles-prime.css","styles-contact.css","styles-trust.css","styles-news.css","styles-careers.css","_headers",
 "scripts/app.js","scripts/motion.js","scripts/v5-cinematic.js","scripts/service-state.js",
 ...allowStatic,...compiled,...typefaces
].sort();
const original=await readFile(resolve(root,"index.html"),"utf8");
const loader=await readFile(resolve(root,"scripts/v5-cinematic.js"),"utf8");
const vision=original.split('<section class="statement" id="vision"')[1]?.split("</section>")[0]||"";
const scene=original.split('<section class="ecosystem" id="ecosistema"')[1]?.split("</section>")[0]||"";
const primeScene=await readFile(resolve(root,"prime.html"),"utf8");
if(!vision.includes('class="v4-flow motion-story statement-journey"')||
 (vision.match(/class="motion-story-unit motion-story-unit--/g)||[]).length!==4||
 scene.includes("motion-story-unit")||scene.includes('class="v6-three-mount"')||!primeScene.includes('class="v6-three-mount"'))
 throw Error("PRIME-LAYOUT-01: missing four approved participants in statement or scene contains duplicate cards.");

if(!original.includes('id="ecosistema"')||original.includes('class="v6-three-mount"')||original.includes("roles-geometry-")||
 !primeScene.includes('class="v6-three-mount"')||
 !primeScene.includes('class="v63-tour"')||
 !original.includes('name="robots" content="noindex,nofollow"'))
 throw Error("Missing integrated Three.js site, guided tour, or noindex gate.");
if(!loader.includes('activationObserver.observe(stage)')||
 !loader.includes('threeStart?.addEventListener("click",loadThree)')||
 !loader.includes('./assets/v6-three.bundle.js'))
 throw Error("Viewport-activated 3D scene is not connected to bundled WebGL or manual fallback.");
if(files.length!==67)throw Error("Too many release files for DESSET Prime: "+files.length);
for(const path of files){
 if(path.split("/").includes("..") || !(path==="assets/v6-three.bundle.js" || /^(?:(?:index|empresa|comercios|repartidores|prime|contacto|confianza|noticias|talento|en|registro-comercios|incorporacion-comercios|registro-repartidores|incorporacion-repartidores|capacitacion-repartidores|aplicaciones|aplicaciones-clientes|aplicaciones-comercios|aplicaciones-repartidores)\.html|styles(?:-v5|-system|-hero-photo|-visual02|-typography|-audiences|-prime|-contact|-trust|-news|-careers|-onboarding|-applications)?\.css|_headers|scripts\/(?:app|motion|v5-cinematic|service-state)\.js|assets\/[a-z0-9-]+\.(?:png|svg|webp|glb)|fonts\/(?:inter-latin-variable|plus-jakarta-sans-latin-variable)\.woff2|fonts\/LICENSE-(?:Inter|Plus-Jakarta-Sans)-OFL\.txt)$/.test(path)))
   throw Error("Unexpected package path: "+path);
 const info=await stat(resolve(root,path));
 if(!info.isFile()||info.size===0)throw Error("Required website file missing/empty: "+path);
 if(path.endsWith(".woff2")){
  const font=await readFile(resolve(root,path));
  if(font.subarray(0,4).toString()!=="wOF2")throw Error("Malformed WOFF2 font: "+path);
 }
 if(path.endsWith(".glb")){
  const first=await readFile(resolve(root,path));
  if(first.subarray(0,4).toString()!=="glTF"||first.readUInt32LE(4)!==2)
   throw Error("Malformed packaged glTF 2.0: "+path);
 }
}
const mainCss=await readFile(resolve(root,"styles.css"));
const cssRevision=createHash("sha1").update("blob "+mainCss.length+"\0").update(mainCss).digest("hex");
if(!original.includes('href="./styles.css?v='+cssRevision+'"'))throw Error("Main stylesheet cache revision does not match source bytes");
const company=await readFile(resolve(root,"empresa.html"),"utf8");
if(!company.includes('href="./styles.css?v='+cssRevision+'"')||!company.includes('name="robots" content="noindex,nofollow"'))throw Error("Company page CSS revision or indexing policy mismatch");
const merchant=await readFile(resolve(root,"comercios.html"),"utf8");
if(!merchant.includes('href="./styles.css?v='+cssRevision+'"')||!merchant.includes('name="robots" content="noindex,nofollow"'))throw Error("Merchant page CSS revision or indexing policy mismatch");
const rider=await readFile(resolve(root,"repartidores.html"),"utf8");
if(!rider.includes('href="./styles.css?v='+cssRevision+'"')||!rider.includes('name="robots" content="noindex,nofollow"'))throw Error("Rider page CSS revision or indexing policy mismatch");
const prime=await readFile(resolve(root,"prime.html"),"utf8");
if(!prime.includes('href="./styles.css?v='+cssRevision+'"')||!prime.includes('name="robots" content="noindex,nofollow"'))throw Error("Prime page CSS revision or indexing policy mismatch");
const contact=await readFile(resolve(root,"contacto.html"),"utf8");
if(!contact.includes('href="./styles.css?v='+cssRevision+'"')||!contact.includes('name="robots" content="noindex,nofollow"'))throw Error("Contact page CSS revision or indexing policy mismatch");
const trust=await readFile(resolve(root,"confianza.html"),"utf8");
if(!trust.includes('href="./styles.css?v='+cssRevision+'"')||!trust.includes('name="robots" content="noindex,nofollow"'))throw Error("Trust page CSS revision or indexing policy mismatch");
const news=await readFile(resolve(root,"noticias.html"),"utf8");
if(!news.includes('href="./styles.css?v='+cssRevision+'"')||!news.includes('name="robots" content="noindex,nofollow"'))throw Error("News page CSS revision or indexing policy mismatch");
const careers=await readFile(resolve(root,"talento.html"),"utf8");
if(!careers.includes('href="./styles.css?v='+cssRevision+'"')||!careers.includes('name="robots" content="noindex,nofollow"'))throw Error("Careers page CSS revision or indexing policy mismatch");
const english=await readFile(resolve(root,"en.html"),"utf8");
if(!english.includes('href="./styles.css?v='+cssRevision+'"')||!english.includes('name="robots" content="noindex,nofollow"'))throw Error("English page CSS revision or indexing policy mismatch");
const registration=await readFile(resolve(root,"registro-comercios.html"),"utf8");
if(!registration.includes('href="./styles.css?v='+cssRevision+'"')||!registration.includes('name="robots" content="noindex,nofollow"'))throw Error("Registration page CSS revision or indexing policy mismatch");
const guide=await readFile(resolve(root,"incorporacion-comercios.html"),"utf8");
if(!guide.includes('href="./styles.css?v='+cssRevision+'"')||!guide.includes('name="robots" content="noindex,nofollow"'))throw Error("Guide page CSS revision or indexing policy mismatch");
const riderOnboarding=await Promise.all(["registro-repartidores","incorporacion-repartidores","capacitacion-repartidores"].map(async name=>{const doc=await readFile(resolve(root,name+".html"),"utf8");if(!doc.includes('href="./styles.css?v='+cssRevision+'"')||!doc.includes('name="robots" content="noindex,nofollow"'))throw Error("Rider onboarding CSS or indexing mismatch: "+name);return doc;}));
assertClosedDistribution(await readFile(resolve(root,"scripts/service-state.js"),"utf8"),JSON.parse(await readFile(resolve(root,"config/app-distribution.json"),"utf8")));
const appDocs=await Promise.all(appPages.map(async name=>{const doc=await readFile(resolve(root,name+".html"),"utf8");assertClosedAppPage(doc,name);if(!doc.includes('href="./styles.css?v='+cssRevision+'"'))throw Error("App page CSS revision mismatch");return doc;}));
const refs=[...(original+company+merchant+rider+prime+contact+trust+news+careers+english+registration+guide+riderOnboarding.join("")+appDocs.join("")).matchAll(/\b(?:src|srcset|href)="(\.\/[^"]+)"/g)]
 .map(m=>m[1].slice(2).split(/\s+/)[0]).map(p=>p==="styles.css?v="+cssRevision?"styles.css":/^(index|empresa|comercios|repartidores|prime|contacto|confianza|noticias|talento|en|registro-comercios|incorporacion-comercios|registro-repartidores|incorporacion-repartidores|capacitacion-repartidores|aplicaciones|aplicaciones-clientes|aplicaciones-comercios|aplicaciones-repartidores)\.html#[a-z-]+$/.test(p)?p.split("#")[0]:p);
for(const href of refs){
 if(href.includes("..")||!files.includes(href))
  throw Error("HTML references absent or disallowed website file: "+href);
}
const pattern=/\.\/assets\/v62-(?:commerce|courier|destination)\.glb/g;
const loaded=await readFile(resolve(root,"scripts/v62-glb-loader.src.mjs"),"utf8");
const modelPaths=[...new Set(loaded.match(pattern)||[])].map(p=>p.slice(2));
if(modelPaths.length!==3||modelPaths.some(p=>!files.includes(p)))
 throw Error("Three original GLB files not linked to the packaged website.");

await rm(target,{recursive:true,force:true});
const manifest={schema:"desset-prime-static-web-package-v1",
 entrypoint:"index.html",scope:"DESSET-prime ONLY, offline artifact, NOT deployed",
 domain:"none",noindex:true,dependencies:{three:"0.187.0",esbuild:"0.28.2"},
 files:[]};
for(const path of files){
 const full=resolve(root,path),dest=resolve(target,path);
 if(!dest.startsWith(target+sep))throw Error("Unsafe output path: "+path);
 await mkdir(resolve(dest,".."),{recursive:true});
 await cp(full,dest,{force:false,errorOnExist:true});
 const bytes=await readFile(dest);
 manifest.files.push({path,bytes:bytes.length,sha256:createHash("sha256").update(bytes).digest("hex")});
}
manifest.totalBytes=manifest.files.reduce((sum,item)=>sum+item.bytes,0);
const manifestBytes=JSON.stringify(manifest,null,2)+"\n";
await writeFile(resolve(target,"site-manifest.json"),manifestBytes);
await mkdir(resolve(root,"reports/quality"),{recursive:true});
await writeFile(resolve(root,"reports/quality/v64-website-package.json"),manifestBytes);
console.log("DESSET Prime full website package PASS: dist/ "+files.length+" files, "+
 manifest.totalBytes+" bytes, 3 verified GLB, all HTML links local, no deployment");
