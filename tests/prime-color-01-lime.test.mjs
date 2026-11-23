import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync,statSync} from "node:fs";
const root=new URL("../",import.meta.url),read=path=>readFileSync(new URL(path,root),"utf8");
const html=read("index.html"),css=read("styles-visual02.css"),audit=read("scripts/browser-audit.mjs");
const marker="\n/* PRIME-COLOR-02",cut=css.indexOf(marker);
const lime="#CDFC8A",oldGold="#FFC62F";
function luminance(hex){
 const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255);
 const c=rgb.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return c[0]*.2126+c[1]*.7152+c[2]*.0722;
}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
test("Only Hablemos de tu negocio retains owner-approved #CDFC8A",()=>{
 assert.ok(cut>0,"Narrow, append-only override required");
 assert.equal((css.match(/#CDFC8A/g)||[]).length,1,"No additional lime-colored element permitted");
 assert.match(css.slice(cut),/^\n\/\* PRIME-COLOR-02[\s\S]*?#inicio \.hero-cta,#inicio \.hero-cta:hover\{background:#CDFC8A\}\s*$/);
 assert.doesNotMatch(css.slice(cut),/:root|#ecosistema|\.business-pitch|\.v4-motion-canvas|--yellow|--ds-10-gold|--v02-gold|box-shadow/);
 assert.match(html,/class="hero-cta" href="#contacto">Hablemos de tu negocio/);
 assert.equal(css.includes("PRIME-COLOR-01"),false,"Do not retain global lime overrides");
 assert.ok(statSync(new URL("styles-visual02.css",root)).size<=8200);
});
test("Every prior institutional color in VISUAL-02 is restored byte-for-byte",()=>{
 const original=css.slice(0,cut);
 const sha=createHash("sha1").update("blob "+Buffer.byteLength(original)+"\0").update(original).digest("hex");
 assert.equal(sha,"58bc1934ced19bd632b2291531c8a505cce365f9", "Previously approved stylesheet modified unexpectedly");
 for(const [path,pattern] of [
  ["styles.css",/--yellow:#FFC62F/],
  ["styles-system.css",/--ds-10-gold:#FFC62F/],
  ["styles-visual02.css",/--v02-gold:#ffc62f/],
  ["styles-hero-photo.css",/#inicio \.hero-cta\{background:#ffc62f/],
  ["styles-v5.css",/--v5-gold:#FFC62F/],
  ["scripts/v6-three.src.mjs",/gold:0xffc62f/]
 ])assert.match(read(path),pattern,"Original yellow missing: "+path);
});
test("The only lime CTA retains WCAG AA contrast and 3D markup remains unchanged",()=>{
 assert.ok(contrast("#111111",lime)>=4.5,"Neutral black ink must remain legible on lime");
 assert.equal(oldGold,"#FFC62F");
 assert.match(html,/class="v6-three-mount"/);
 assert.match(html,/class="v63-tour"/);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
});
test("Browser QA enforces gold on other elements, green only in hero, and reproducible dist",()=>{
 for(const key of ["heroCTA","businessCTA","statementAccent","stageSummaryArrow","threeTourButton","rootYellow","stageYellow","stageDesignGold","stageVisualGold"])
  assert.ok(audit.includes(key),"Missing computed-color measurement "+key);
 assert.match(audit,/PRIME-COLOR-02: only the hero CTA may be lime/);
 assert.equal(read("dist/styles-visual02.css"),css,"Dist must match the source exactly");
 const manifest=JSON.parse(read("dist/site-manifest.json"));
 assert.equal(manifest.noindex,true);assert.equal(manifest.domain,"none");
 for(const path of ["styles-visual02.css","assets/v62-commerce.glb","assets/v62-courier.glb","assets/v62-destination.glb"])
  assert.ok(manifest.files.some(e=>e.path===path),"Source/dist integrity required for "+path);
});

test("Browser QA waits for the final opaque CTA instead of accepting a transient alpha",()=>{
 const settle=audit.indexOf("fully opaque hero CTA background after its CSS transition");
 const sample=audit.indexOf("const palette={");
 assert.ok(settle>0&&sample>settle,"Color must settle BEFORE browser palette sampling");
 assert.match(audit,/return !match\|\|Number\(match\[1\]\)>=0\.9999/);
 assert.match(audit,/Number\(limeChannels\[1\]\)>=\.9999/);
 assert.doesNotMatch(audit,/Number\(limeChannels\[1\]\)>=\.99&&/,"Do not weaken final alpha threshold");
 assert.match(audit,/PRIME-COLOR-02: only the hero CTA may be lime/);
});
