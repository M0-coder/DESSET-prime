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
 assert.match(section,/<h2 id="desset-prime-heading">DESSET PRIME<\/h2>/);
 assert.match(section,/<p><strong>FROM HUB TO DOOR<\/strong> fulfillment, dispatch, and last-mile delivery working as one system\.<\/p>/);
 assert.ok(section.indexOf('class="prime-3d-heading"')<section.indexOf('class="v5-city-stage"'),"Title must remain visible when WebGL is active");
 assert.match(section,/aria-labelledby="desset-prime-heading"/);
 assert.match(section,/class="v6-three-mount" aria-hidden="true"/);
 assert.match(section,/class="v6-three-controls"/);
 assert.match(section,/Los camiones y los indicadores son simulaciones/);
});
test("PRIME-HUB-01: DESSET blue title, black English text and mobile-friendly scale",()=>{
 assert.match(css,/#ecosistema \.prime-3d-heading h2\{margin:0;color:#1551d8/);
 assert.match(css,/#ecosistema \.prime-3d-heading p\{margin:12px 0 0;color:#111827/);
 assert.match(css,/#ecosistema \.prime-3d-heading p strong\{display:block;color:#111827/);
 assert.match(css,/font-size:clamp\(36px,5\.6vw,74px\)/);
 assert.match(audit,/primeHeadingColor:style\("#desset-prime-heading"\)\.color/);
 assert.match(audit,/palette\.primeHeadingColor!==brandBlue/);
 for(const [fg,bg] of [["#1551d8","#eef0ef"],["#111827","#eef0ef"]]){
  assert.ok(contrast(fg,bg)>=4.5,`${fg} on ${bg} fails normal-text contrast`);
 }
});
