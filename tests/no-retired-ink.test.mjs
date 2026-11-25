import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
import {join,resolve} from "node:path";
import {fileURLToPath} from "node:url";

const root=resolve(fileURLToPath(new URL("../",import.meta.url)));
const read=path=>readFileSync(join(root,path),"utf8");
const retired="#"+["11","18","27"].join("");
const retiredRgb=/rgba?\(\s*17\s*,\s*24\s*,\s*39\s*[,)]/i;
const filesIn=(folder,exts)=>readdirSync(join(root,folder),{withFileTypes:true})
 .filter(e=>e.isFile()&&exts.some(ext=>e.name.endsWith(ext))).map(e=>folder+"/"+e.name);

test("INK-REMOVAL-01: retired charcoal pigment is absent from every published text asset and its source",()=>{
 const sources=[
  "index.html",
  ...readdirSync(root).filter(x=>x.startsWith("styles")&&x.endsWith(".css")),
  ...filesIn("scripts",[".js",".mjs"]),
  ...filesIn("assets",[".svg"]),
  ...filesIn("tests",[".test.mjs"]),
 ];
 for(const path of sources){
  const body=read(path);
  assert.ok(!body.toLowerCase().includes(retired),`Retired hex survived in source ${path}`);
  assert.doesNotMatch(body,retiredRgb,`Retired RGB survived in source ${path}`);
 }
 const shipped=["index.html","_headers",
  ...readdirSync(join(root,"dist")).filter(x=>x.endsWith(".css")),
  ...filesIn("dist/scripts",[".js"]).map(x=>x.slice(5)),
  ...filesIn("dist/assets",[".svg"]).map(x=>x.slice(5)),
 ];
 for(const file of shipped){
  const path="dist/"+file;
  const body=read(path);
  assert.ok(!body.toLowerCase().includes(retired),`Retired hex survived in deployable output ${path}`);
  assert.doesNotMatch(body,retiredRgb,`Retired RGB survived in deployable output ${path}`);
 }
});
test("INK-REMOVAL-01: actual source colors were replaced, never masked by extra CSS",()=>{
 const system=read("styles-system.css"),hero=read("styles-hero-photo.css");
 const scene=read("styles-v5.css"),diagram=read("assets/roles-geometry-mobile-es.svg");
 assert.match(system,/--ds-30-ink:#111111/);
 assert.match(hero,/#inicio \.v4-headline-a\{color:#111111\}/);
 assert.match(hero,/#inicio \.prime-photo-surface\{[^\n]*background:#f4f8fe/);
 assert.match(scene,/#ecosistema \.prime-3d-heading p\{[^\n]*color:#111111/);
 assert.match(scene,/#ecosistema \.prime-3d-heading p strong\{[^\n]*color:#111111/);
 assert.match(diagram,/<rect x="18" y="221"[^>]+fill="#1551D8"/);
 assert.match(diagram,/<text x="267" y="96" fill="#1551D8">COMERCIOS<\/text>/);
 assert.match(diagram,/<text x="267" y="297" fill="#1551D8">CONTROL<\/text>/);
 assert.match(read("index.html"),/<h2 id="desset-prime-heading">DESSET PRIME<\/h2>/);
 assert.match(read("index.html"),/FROM HUB TO DOOR/);
});
test("INK-REMOVAL-01: the revised mobile SVG is registered with its exact asset SHA256",()=>{
 const register=JSON.parse(read("config/prime-original-assets.json"));
 const asset=register.assets.find(x=>x.path==="assets/roles-geometry-mobile-es.svg");
 assert.equal(asset?.sha256,"5df568e52c15103660ffdf8513d97c0d5ea31a1a37279a4733e9632fb25d1fbf");
});
test("INK-REMOVAL-01: revised blue ink remains WCAG AA on light backgrounds",()=>{
 const lum=hex=>{
  const nums=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255)
   .map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
  return nums[0]*.2126+nums[1]*.7152+nums[2]*.0722;
 };
 for(const background of ["#ffffff","#f4f8fe","#f7f5ee","#cdfc8a"]){
  const a=lum("#111111"),b=lum(background);
  assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`Insufficient neutral-ink contrast on ${background}`);
 }
});

test("INK-REMOVAL-02: all authored pages, styles, SVG and visual scripts reject dark blue pigments",()=>{
 const navy=(r,g,b)=>b>r+9&&b>=g+5&&r<=80&&g<=105&&b<=155;
 const assertNeutral=(path)=>{
  const body=read(path);
  for(const match of body.matchAll(/(?:#|0x)([0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3})(?![0-9a-f])/gi)){
   let hex=match[1]; if(hex.length===3)hex=[...hex].map(x=>x+x).join("");
   const [r,g,b]=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));
   assert.ok(!navy(r,g,b),"Dark blue "+match[0]+" in "+path);
  }
  for(const m of body.matchAll(/rgba?\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)(?=\s*[,/)])/gi))
   assert.ok(!navy(+m[1],+m[2],+m[3]),"Dark blue "+m[0]+" in "+path);
 };
 for(const folder of ["","dist/"]){
  for(const name of readdirSync(join(root,folder)))if(/\.(html|css)$/.test(name))assertNeutral(folder+name);
  for(const path of filesIn(folder+"assets",[".svg"]))assertNeutral(path);
 }
 for(const path of ["scripts/app.js","scripts/motion.js","scripts/service-state.js","scripts/v5-cinematic.js","scripts/v6-three.src.mjs","scripts/v62-glb-loader.src.mjs","scripts/build-glb-models.mjs"])assertNeutral(path);
 for(const prefix of ["","dist/"]){
  assert.match(read(prefix+"styles-prime.css"),/\.pr-hero,\.prime-page \.pr-vision\{background:#000000;color:#fff/);
  assert.match(read(prefix+"styles-trust.css"),/\.tr-hero\{background:#000000;color:#fff/);
  assert.match(read(prefix+"styles-careers.css"),/\.ca-closing\{background:#000000;color:#fff/);
  assert.match(read(prefix+"styles-visual02.css"),/--v02-deep:#000000/);
  assert.match(read(prefix+"styles-prime.css"),/color:#1551d8/);
 }
});
