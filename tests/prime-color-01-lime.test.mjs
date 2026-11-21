import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
const root=new URL("../",import.meta.url),read=path=>readFileSync(new URL(path,root),"utf8");
const html=read("index.html"),css=read("styles-visual02.css"),audit=read("scripts/browser-audit.mjs");
const tail=css.split("/* PRIME-COLOR-01")[1]||"";
const light="#CDFC8A",stage="#FFC62F";
function luminance(hex){
 const c=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return c[0]*.2126+c[1]*.7152+c[2]*.0722;
}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
test("PRIME-COLOR-01 replaces all institutional yellow tokens with exact #CDFC8A",()=>{
 assert.ok(tail.startsWith(" — Owner-requested institutional accent #CDFC8A."));
 assert.match(tail,/:root\{\s*--ds-institutional-lime:#CDFC8A;\s*--yellow:var\(--ds-institutional-lime\);\s*--ds-10-gold:var\(--ds-institutional-lime\);\s*--v02-gold:var\(--ds-institutional-lime\);/);
 assert.match(html,/Hablemos de tu negocio/);
 assert.match(tail,/#inicio \.hero-cta\{\s*background:var\(--ds-institutional-lime\)/);
 assert.match(tail,/#inicio \.hero-cta:hover\{background:#E7FFC4\}/);
 assert.match(tail,/#inicio \.v4-motion-canvas\{\s*box-shadow:0 22px 55px rgba\(1,9,28,\.27\),7px 8px 0 rgba\(205,252,138,\.88\)/);
 assert.match(tail,/@media\(max-width:700px\)/);
 assert.ok(statSync(new URL("styles-visual02.css",root)).size<=8200);
});
test("Entire 3D ecosystem retains original yellow tokens, scene materials and interactive controls",()=>{
 assert.match(tail,/#ecosistema\{\s*--yellow:#FFC62F;\s*--ds-10-gold:#FFC62F;\s*--v02-gold:#FFC62F;/);
 assert.doesNotMatch(tail,/#[^\s,{]*v6-three[^\n{]*\{|#[^\s,{]*v63-tour[^\n{]*\{|#ecosistema\s+\.[^\n{]+\{/);
 const v5=read("styles-v5.css"),three=read("scripts/v6-three.src.mjs");
 assert.match(v5,/--v5-gold:#FFC62F/);
 assert.match(v5,/\.v6-three-controls \.v63-tour\{\s*background:#ffc62f/);
 assert.match(three,/gold:0xffc62f/);
 assert.match(html,/class="v6-three-mount"/);
 assert.match(html,/class="v63-tour"/);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
});
test("Lime accent meets WCAG AA text contrast on ink, navy and blue backgrounds",()=>{
 for(const bg of ["#111827","#142239","#1551D8"])assert.ok(contrast(light,bg)>=4.5,"Lime-on-"+bg+" contrast too low");
 assert.ok(contrast("#111827",light)>=4.5,"Ink-on-lime CTA text insufficient");
 assert.equal(stage,"#FFC62F");
});
test("Five viewport browser measurements compare institutional CTA and unchanged 3D gold",()=>{
 for(const name of ["heroCTA","businessCTA","statementAccent","stageSummaryArrow","threeTourButton","rootYellow","stageYellow","stageDesignGold","stageVisualGold"])assert.ok(audit.includes(name),"Missing computed palette evidence "+name);
 assert.match(audit,/PRIME-COLOR-01: institutional lime or 3D gold isolation failed/);
 const dist=read("dist/styles-visual02.css");
 assert.equal(dist,css,"Local signed build must preserve the exact CSS cascade");
 const manifest=JSON.parse(read("dist/site-manifest.json"));
 assert.equal(manifest.noindex,true);assert.equal(manifest.domain,"none");
 for(const filename of ["styles-visual02.css","assets/v62-commerce.glb","assets/v62-courier.glb","assets/v62-destination.glb"])assert.ok(manifest.files.some(x=>x.path===filename));
});
