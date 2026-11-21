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
check(manifest.files.length>=18&&manifest.files.length<40,"unexpected file count");
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
const loader=await readFile(resolve(dist,"scripts/v5-cinematic.js"),"utf8");
check(html.includes('id="ecosistema"')&&html.includes('aria-label="Recorrido visual: elegir, preparar y entregar"')&&
 !html.includes('data-v64-tour-launch'),"3D section landmark or duplicate hero CTA regression");
check(html.includes('class="v63-tour"')&&html.includes('class="v6-three-mount"'),"3D tour not mounted in ecosystem");
check(html.includes('name="robots" content="noindex,nofollow"'),"noindex absent");
check(loader.includes('activationObserver.observe(stage)')&&loader.includes('threeStart?.addEventListener("click",loadThree)')&&
 loader.includes('./assets/v6-three.bundle.js'),"3D viewport activation or manual fallback not connected");
for(const name of ["commerce","courier","destination"]){
 const path="assets/v62-"+name+".glb";
 check(expected.has(path),"GLB missing "+name);
 const bytes=await readFile(resolve(dist,path));
 check(bytes.toString("ascii",0,4)==="glTF"&&bytes.readUInt32LE(4)===2,"invalid GLB "+name);
}
check(expected.has("assets/v6-three.bundle.js"),"Three.js bundle is missing");
check(expected.has("styles-system.css")&&html.includes('href="./styles-system.css"'),"60/30/10 design CSS not packaged");
check(expected.has("styles-hero-photo.css")&&html.includes('href="./styles-hero-photo.css"'),"Photographic stylesheet missing");
check(expected.has("styles-visual02.css")&&html.includes('href="./styles-visual02.css"'),"VISUAL-02 editorial stylesheet missing");
check(expected.has("assets/desset-hero-entrega-dos-espejos.webp")&&html.includes('src="./assets/desset-hero-entrega-dos-espejos.webp"'),"Approved photographic render is not packaged");
check(expected.has("assets/desset-hero-entrega-mobile.webp")&&html.includes('srcset="./assets/desset-hero-entrega-mobile.webp"'),"Mobile photographic LCP asset missing");
check(!html.includes("IDEAS</span>")&&!html.includes("ACCIÓN</span>"),"Unrelated old slogan was left");
check(expected.has("scripts/service-state.js")&&html.includes('src="./scripts/service-state.js"'),"Institutional availability module not packaged");
const availability=await readFile(resolve(dist,"scripts/service-state.js"),"utf8");
check(availability.includes('applicationDistribution:"not_published"')&&availability.includes('verified:false'),"Unapproved application publication status");
check(html.includes('data-service-access')&&html.includes('data-service-status'),"Availability block missing from packaged site");
check(expected.has("assets/roles-geometry-es.svg")&&!expected.has("assets/roles-geometry-v2.svg"),"Only localized diagram may be distributed; sealed original remains source-only");
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
