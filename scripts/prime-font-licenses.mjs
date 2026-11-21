/** Strict, offline integrity and redistribution gate for DESSET Prime's two OFL fonts.
 * Source: fontsource/font-files @ 5a72889057f592bb0659629e38337359f94d53b2.
 * SHA-1 is used ONLY for upstream Git object identity; dist itself uses SHA-256.
 * This never confers ownership of third-party typefaces on DESSET.
 */
import {createHash} from "node:crypto";
import {readFileSync,lstatSync} from "node:fs";
import {join,resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";

const project=resolve(dirname(fileURLToPath(import.meta.url)),"..");
const pinned=[
 {font:"fonts/inter-latin-variable.woff2",blob:"d15208de03cd1ad7c5199f0a0ce915fe841e4722",
  license:"fonts/LICENSE-Inter-OFL.txt",licenseBlob:"40589daa9de8bc96606292ea0be712ff0f0626eb",family:"DESSET Inter"},
 {font:"fonts/plus-jakarta-sans-latin-variable.woff2",blob:"a180dc40f205fc48979a75ccbe8a10221a71a4ba",
  license:"fonts/LICENSE-Plus-Jakarta-Sans-OFL.txt",licenseBlob:"d82b0820892c94be963fd958ef1817245c52a472",family:"DESSET Jakarta"}
];
const fail=reason=>{throw Error("FONT RIGHTS NO-GO: "+reason)};
const gitBlob=bytes=>createHash("sha1").update(Buffer.from("blob "+bytes.length)).update(Buffer.from([0])).update(bytes).digest("hex");
function valid(root,path,sha){
 const full=join(root,path),st=lstatSync(full);
 if(!st.isFile()||st.isSymbolicLink())fail("non-regular file "+path);
 const buf=readFileSync(full);
 if(gitBlob(buf)!==sha)fail("upstream content changed "+path);
 return buf;
}
export function checkPrimeFonts({sourceRoot=project,distDir=null}={}){
 const css=readFileSync(join(sourceRoot,"styles-typography.css"),"utf8");
 const html=readFileSync(join(sourceRoot,"index.html"),"utf8");
 if(/@import\b|https?:\/\//i.test(css)||!html.includes('href="./styles-typography.css"'))fail("external or absent typography stylesheet");
 const manifest=distDir?JSON.parse(readFileSync(join(distDir,"site-manifest.json"),"utf8")):null;
 for(const spec of pinned){
  const font=valid(sourceRoot,spec.font,spec.blob),license=valid(sourceRoot,spec.license,spec.licenseBlob);
  if(font.subarray(0,4).toString()!=="wOF2"||font.length<15000)fail("bad font format "+spec.font);
  if(!license.toString().includes("SIL OPEN FONT LICENSE Version 1.1"))fail("missing OFL terms "+spec.license);
  if(!css.includes('font-family:"'+spec.family+'"')||!css.includes('url("./'+spec.font+'")'))fail("font declaration missing "+spec.family);
  if(!html.includes('href="./'+spec.font+'" as="font" type="font/woff2" crossorigin'))fail("preload missing "+spec.font);
  if(manifest){
   for(const [path,buf] of [[spec.font,font],[spec.license,license]]){
    const packed=valid(distDir,path,path===spec.font?spec.blob:spec.licenseBlob);
    const entry=manifest.files.find(x=>x.path===path);
    if(!entry||entry.bytes!==buf.length||entry.sha256!==createHash("sha256").update(packed).digest("hex"))fail("manifest mismatch "+path);
   }
  }
 }
 return {status:"PASS",families:pinned.length,license:"SIL-OFL-1.1",font_files:pinned.map(x=>x.font),
  license_files:pinned.map(x=>x.license),upstream:"fontsource/font-files",commit:"5a72889057f592bb0659629e38337359f94d53b2",
  owner_title:"third-party—not owned by DESSET",production_authorized:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(checkPrimeFonts({distDir:process.argv[2]?resolve(process.argv[2]):null})));}
 catch(e){console.error(e.message);process.exitCode=1;}
}
