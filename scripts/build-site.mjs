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
const allowStatic=assets.filter(name=>/^[a-z0-9-]+\.(?:png|svg|webp)$/.test(name))
 .map(name=>"assets/"+name);
const compiled=["assets/v6-three.bundle.js",
 "assets/v62-commerce.glb","assets/v62-courier.glb","assets/v62-destination.glb"];
const files=[
 "index.html","styles.css","styles-v5.css","_headers",
 "scripts/app.js","scripts/motion.js","scripts/v5-cinematic.js",
 ...allowStatic,...compiled
].sort();
const original=await readFile(resolve(root,"index.html"),"utf8");
const loader=await readFile(resolve(root,"scripts/v5-cinematic.js"),"utf8");
if(!original.includes('data-v64-tour-launch')||!original.includes('id="ecosistema"')||
 !original.includes('class="v6-three-mount"')||
 !original.includes('class="v63-tour"')||
 !original.includes('name="robots" content="noindex,nofollow"'))
 throw Error("Missing integrated Three.js site, guided tour, or noindex gate.");
if(!loader.includes('stage.dataset.v64Requested="tour"')||
 !loader.includes('./assets/v6-three.bundle.js'))
 throw Error("Hero link is not connected to locally bundled WebGL.");
if(files.length>40)throw Error("Too many release files for DESSET Prime experiment: "+files.length);
for(const path of files){
 if(path.split("/").includes("..") || !(path==="assets/v6-three.bundle.js" || /^(?:index\.html|styles(?:-v5)?\.css|_headers|scripts\/(?:app|motion|v5-cinematic)\.js|assets\/[a-z0-9-]+\.(?:png|svg|webp|glb))$/.test(path)))
   throw Error("Unexpected package path: "+path);
 const info=await stat(resolve(root,path));
 if(!info.isFile()||info.size===0)throw Error("Required website file missing/empty: "+path);
 if(path.endsWith(".glb")){
  const first=await readFile(resolve(root,path));
  if(first.subarray(0,4).toString()!=="glTF"||first.readUInt32LE(4)!==2)
   throw Error("Malformed packaged glTF 2.0: "+path);
 }
}
const refs=[...original.matchAll(/\b(?:src|srcset|href)="(\.\/[^"]+)"/g)]
 .map(m=>m[1].slice(2).split(/\s+/)[0]);
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
