import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync,statSync} from "node:fs";
const root=new URL("../",import.meta.url),read=path=>readFileSync(new URL(path,root),"utf8");
const html=read("index.html"),css=read("styles-visual02.css"),audit=read("scripts/browser-audit.mjs");
const marker="\n/* PRIME-COLOR-03",cut=css.indexOf(marker);
const blue="#073BBC",oldGold="#FFC62F";
function luminance(hex){
 const rgb=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255);
 const c=rgb.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return c[0]*.2126+c[1]*.7152+c[2]*.0722;
}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)}
test("Historical blue override stays intact; editorial hero owns the white CTA",()=>{
 assert.ok(cut>0,"Narrow, append-only override required");
 assert.doesNotMatch(css,/#cdfc8a/i,"The retired lime must not remain");
 assert.match(css.slice(cut),/^\n\/\* PRIME-COLOR-03[\s\S]*?#inicio \.hero-cta,#inicio \.hero-cta:hover\{background:#073BBC;color:#FFFFFF;box-shadow:0 4px 0 rgba\(7,59,188,\.25\)\}\s*$/);
 assert.doesNotMatch(css.slice(cut),/:root|#ecosistema|\.business-pitch|\.v4-motion-canvas|--yellow|--ds-10-gold|--v02-gold/);
 assert.match(html,/class="hero-cta" href="\.\/mision-vision-valores\.html#proposito">Conoce nuestro propósito/);
 assert.match(read("styles-hero-editorial.css"),/\.hero-cta:hover\{[^}]*background:transparent;color:#fff[^}]*border:1px solid #fff/);
 assert.equal(css.includes("PRIME-COLOR-01"),false,"Do not retain global lime overrides");
 assert.ok(statSync(new URL("styles-visual02.css",root)).size<=8200);
});
test("VISUAL-02 preserves the approved stylesheet except the explicitly authorized neutral and brand-blue edits",()=>{
 const hierarchy=css.indexOf("\n/* VISUAL-HIERARCHY-01:");assert.ok(hierarchy>0&&hierarchy<cut);const revised=css.slice(0,hierarchy);
 assert.equal(revised.split("--v02-deep:#000000;").length,2,"Exactly one authorized black editorial token");
 assert.equal(revised.split("#ecosistema .ecosystem-board{background:#fff;").length,2,"Exactly one authorized neutral role panel");
 assert.equal(revised.split("--v02-blue:#073bbc;").length,2,"Exactly one authorized institutional blue token");
 assert.equal(revised.split(".service--main{border:1px solid #073bbc;").length,2,"Exactly one authorized blue service border");
 const restored=revised.replace("#ecosistema .ecosystem-board{background:#fff;border:1px solid #d5dae2;box-shadow:none}\n#ecosistema .v4-architecture-inner{background:#fff}\n#ecosistema summary,#ecosistema summary .disclosure-indicator{color:#073bbc}","#ecosistema .ecosystem-board{background:#142239;border:1px solid #304158;box-shadow:0 23px 60px rgba(18,32,50,.18)}\n#ecosistema .v5-city-stage{border:1px solid rgba(230,236,247,.18);box-shadow:0 14px 32px rgba(0,0,0,.16)}").replace("#ecosistema .ecosystem-board{box-shadow:none}","#ecosistema .ecosystem-board{box-shadow:0 14px 34px rgba(18,32,50,.15)}");
 const original=restored.replace("--v02-blue:#073bbc;","--v02-blue:#1551d8;").replace(".service--main{border:1px solid #073bbc;",".service--main{border:1px solid #1755d4;").replace("--v02-deep:#000000;","--v02-deep:#142239;").replace("#ecosistema .ecosystem-board{background:#142239;","#ecosistema .ecosystem-board{background:var(--v02-deep);");
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
test("The blue CTA retains WCAG AA contrast and 3D markup remains unchanged",()=>{
 assert.ok(contrast("#FFFFFF",blue)>=4.5,"White text must remain legible on institutional blue");
 assert.equal(oldGold,"#FFC62F");
 assert.match(read("prime.html"),/class="v6-three-mount"/);
 assert.match(read("prime.html"),/class="v63-tour"/);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
});
test("Browser QA enforces gold on other elements, blue in hero, and reproducible dist",()=>{
 for(const key of ["heroCTA","businessCTA","statementAccent","railDisplay","titleInk","threeTourButton","rootYellow","stageYellow","stageDesignGold","stageVisualGold"])
  assert.ok(audit.includes(key),"Missing computed-color measurement "+key);
 assert.match(audit,/HERO-EDITORIAL-02: hero CTA must use opaque white outline and white text/);
 assert.equal(read("dist/styles-visual02.css"),css,"Dist must match the source exactly");
 const manifest=JSON.parse(read("dist/site-manifest.json"));
 assert.equal(manifest.noindex,true);assert.equal(manifest.domain,"none");
 for(const path of ["styles-visual02.css","assets/v62-commerce.glb","assets/v62-courier.glb","assets/v62-destination.glb"])
  assert.ok(manifest.files.some(e=>e.path===path),"Source/dist integrity required for "+path);
});

test("Browser QA waits for the final opaque CTA instead of accepting a transient alpha",()=>{
 const settle=audit.indexOf("fully opaque hero CTA border after its CSS transition");
 const sample=audit.indexOf("const palette={");
 assert.ok(settle>0&&sample>settle,"Color must settle BEFORE browser palette sampling");
 assert.match(audit,/return !match\|\|Number\(match\[1\]\)>=0\.9999/);
 assert.match(audit,/Number\(whiteChannels\[1\]\)>=\.9999/);
 assert.doesNotMatch(audit,/Number\(whiteChannels\[1\]\)>=\.99&&/,"Do not weaken final alpha threshold");
 assert.match(audit,/HERO-EDITORIAL-02: hero CTA must use opaque white outline and white text/);
});
