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
 assert.match(system,/--ds-30-ink:#000000/);
 assert.match(hero,/#inicio \.v4-headline-a\{color:#000000\}/);
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
  const a=lum("#000000"),b=lum(background);
  assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`Insufficient neutral-ink contrast on ${background}`);
 }
});

test("INK-REMOVAL-02: institutional sections use black without recoloring visual components",()=>{
 for(const prefix of ["","dist/"]){
  const prime=read(prefix+"styles-prime.css"),trust=read(prefix+"styles-trust.css"),careers=read(prefix+"styles-careers.css"),editorial=read(prefix+"styles-visual02.css");
  assert.match(prime,/\.pr-hero,\.prime-page \.pr-vision\{background:#000000;color:#fff/);
  assert.match(prime,/\.pr-button\{[^}]*background:#fff;color:#000000/);
  assert.match(trust,/\.tr-hero\{background:#000000;color:#fff/);
  assert.match(careers,/\.ca-closing\{background:#000000;color:#fff/);
  assert.match(editorial,/--v02-deep:#000000/);
  assert.match(editorial,/#ecosistema \.ecosystem-board\{background:#142239;border:1px solid #304158;box-shadow:0 23px 60px rgba\(18,32,50,\.18\)/);
  assert.match(read(prefix+"styles-typography.css"),/#ecosistema \.ecosystem-board\{background:#fff/);
  assert.match(prime,/\.pr-vision-art img\{background:#203b5a\}/);
  assert.match(prime,/color:#073bbc/);
 }
});

test("BRAND-BLUE-01: new interface blue in source and package; legacy visual colors remain scoped",()=>{
 const uiStyles=["styles.css","styles-system.css","styles-prime.css","styles-typography.css","styles-hero-photo.css","styles-visual02.css","styles-applications.css","styles-audiences.css","styles-careers.css","styles-contact.css","styles-news.css","styles-onboarding.css","styles-trust.css"];
 for(const prefix of ["","dist/"]){
  for(const file of uiStyles){
   const content=read(prefix+file);
   assert.match(content,/#073bbc\b/i,file+" must use the new brand blue");
   const withoutProtected=content.replace(/\/\*[\s\S]*?\*\//g,"").replace("position:relative;isolation:isolate;background:#1551d8;","");
   assert.doesNotMatch(withoutProtected,/#1551d8(?![0-9a-f])/i,file+" contains an unapproved legacy interface blue");
  }
  assert.match(read(prefix+"styles-v5.css"),/#1551d8/i);
  assert.match(read(prefix+"styles-prime.css"),/\.pr-kicker\{[^}]*color:#b7caff/);
  assert.match(read(prefix+"styles.css"),/position:relative;isolation:isolate;background:#1551d8;/);
 }
 const lum=h=>{const [r,g,b]=h.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*r+.7152*g+.0722*b};
 const contrast=(a,b)=>(Math.max(lum(a),lum(b))+.05)/(Math.min(lum(a),lum(b))+.05);
 for(const bg of ["#ffffff","#f4f8fe","#f7f5ee"])assert.ok(contrast("#073bbc",bg)>=7);
 assert.ok(contrast("#b7caff","#000000")>=4.5);
 assert.ok(contrast("#073bbc","#000000")<3,"Dark surfaces require the separate light-blue accent");
});
