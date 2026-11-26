import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const base=new URL("../",import.meta.url);
const read=name=>readFileSync(new URL(name,base),"utf8");
const html=read("index.html"),css=read("styles-v5.css"),audit=read("scripts/browser-audit.mjs");
function lum(hex){
 const c=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255)
  .map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return .2126*c[0]+.7152*c[1]+.0722*c[2];
}
function contrast(a,b){const x=lum(a),y=lum(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
test("PRIME-HUB-01: chapter title and owner-specified English message appear outside the 3D canvas",()=>{
 const section=html.split('<section class="ecosystem" id="ecosistema"')[1]?.split("</section>")[0];
 assert.ok(section,"Ecosystem section absent");
 assert.match(section,/<h2 id="desset-prime-heading">DESSET prime<\/h2>/);
 assert.match(section,/Paquetería, distribución y tecnología logística/);
 const model=read("prime.html").match(/<section class="pr-flow" id="modelo">[\s\S]*?<\/section>/)?.[0];assert.ok(model&&model.indexOf("Cada movimiento cuenta.")<model.indexOf('class="v5-city-stage"'));assert.doesNotMatch(section,/v5-city-stage/);
 assert.match(section,/aria-labelledby="desset-prime-heading"/);
 assert.match(model,/class="v6-three-mount" aria-hidden="true"/);
 assert.match(model,/class="v6-three-controls"/);
 assert.match(model,/Los camiones y los indicadores son simulaciones/);
});
test("PRIME-HUB-01: DESSET blue title, blue-ink English text and mobile-friendly scale",()=>{
 assert.match(css,/#ecosistema \.prime-3d-heading h2\{margin:0;color:#1551d8/);
 assert.match(css,/#ecosistema \.prime-3d-heading p\{margin:12px 0 0;color:#111111/);
 assert.match(css,/#ecosistema \.prime-3d-heading p strong\{display:block;color:#111111/);
 assert.match(css,/font-size:clamp\(36px,5\.6vw,74px\)/);
 assert.match(audit,/primeHeadingColor:style\("#desset-prime-heading"\)\.color/);
 // The 3D chapter retains its original blue independently of the institutional UI.
 assert.match(audit,/palette\.primeHeadingColor!=="rgb\(21, 81, 216\)"/);
 for(const [fg,bg] of [["#1551d8","#eef0ef"],["#111111","#eef0ef"]]){
  assert.ok(contrast(fg,bg)>=4.5,`${fg} on ${bg} fails normal-text contrast`);
 }
});
