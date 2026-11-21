import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import {createHash} from "node:crypto";
const root=new URL("../",import.meta.url),read=p=>readFileSync(new URL(p,root),"utf8");
const html=read("index.html"),css=read("styles-visual02.css"),browser=read("scripts/browser-audit.mjs");
const files=[
 ["scene-choose","dec4dc273aea16cc18a284fbd655be5f737a4569db8f1ada864d6647e3d43f16"],
 ["scene-prepare","df910bf70b1c1ee10eb359e5eea61d42c91d3d00312c70150ba85a828648189c"],
 ["scene-move","13cfbac37a561198544f7e639b7fc730c07747ce6d800f0cf555ac1d96326224"]
];
test("VISUAL-03 three independently approved photos, never the photographic hero repeated",()=>{
 assert.equal((html.match(/<picture class="v03-photo-story">/g)||[]).length,3);
 assert.equal((html.match(/srcset="\.\/assets\/scene-(?:choose|prepare|move)\.webp"/g)||[]).length,3);
 assert.equal((html.match(/<source type="image\/webp" srcset="\.\/assets\/desset-hero-entrega-dos-espejos\.webp"/g)||[]).length,0);
 for(const [name] of files){
  assert.match(html,new RegExp('srcset="\\./assets/'+name+'\\.webp"'));
  assert.match(html,new RegExp('src="\\./assets/'+name+'\\.svg"'));
 }
 for(const word of ["ELEGIR","PREPARAR","ENTREGAR"])assert.match(html,new RegExp("<h3>"+word+"</h3>"));
 assert.match(html,/motocicleta de dos espejos/);
 assert.match(html,/Hablemos de tu negocio/);
 assert.match(html,/deliver-assets-mark\.png/);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
});
test("VISUAL-03 binary WebP assets match the three correct supplied reference images",()=>{
 const hashes=new Set();
 for(const [name,sha] of files){
  const payload=readFileSync(new URL("assets/"+name+".webp",root));
  assert.ok(payload.length<120000,"Per-card photo budget exceeded: "+name);
  assert.equal(payload.toString("ascii",0,4),"RIFF");
  assert.equal(payload.toString("ascii",8,12),"WEBP");
  assert.equal(createHash("sha256").update(payload).digest("hex"),sha);
  hashes.add(sha);
 }
 assert.equal(hashes.size,3,"Each narrative step must be a distinct photograph");
});
test("VISUAL-03 replaces the false hero-crop overlay with clean, accessible photo cards",()=>{
 assert.match(css,/VISUAL-03: three independent user-approved photographs/);
 assert.match(css,/\.v03-photo-story img\{display:block;width:100%;height:100%;object-fit:cover;/);
 assert.doesNotMatch(css,/\.v03-photo-story::after|--v03-focus|background-image:url\("\.\/assets\/desset-hero-entrega-dos-espejos\.webp"\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{#vision \.v03-photo-story img/);
 assert.ok(statSync(new URL("styles-visual02.css",root)).size<=8200);
 assert.doesNotMatch(css,/https?:\/\/|@import|@font-face/);
 assert.match(browser,/VISUAL-03 three different approved photos, exact sizes, original SVG fallbacks/);
});
test("VISUAL-03 packaged assets also retain WebP checksums and use no public domain",()=>{
 const manifest=JSON.parse(read("dist/site-manifest.json"));
 assert.equal(manifest.domain,"none");assert.equal(manifest.noindex,true);
 for(const [name,sha] of files){
  const original=readFileSync(new URL("assets/"+name+".webp",root));
  const packaged=readFileSync(new URL("dist/assets/"+name+".webp",root));
  assert.deepEqual(packaged,original);
  assert.equal(createHash("sha256").update(packaged).digest("hex"),sha);
  assert.ok(manifest.files.some(f=>f.path==="assets/"+name+".webp"));
 }
});
