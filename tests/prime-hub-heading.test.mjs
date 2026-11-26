import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
for(const dir of ["","dist/"])test("Redundant Prime chapter removed; existing service card retains blue video-overlay wordmark and working links "+(dir||"source"),()=>{
 const home=read(dir+"index.html"),prime=read(dir+"prime.html"),css=read(dir+"styles-hero-photo.css");
 assert.doesNotMatch(home,/<section class="ecosystem"|prime-3d-heading|desset-prime-heading|prime-model-link/);
 const card=home.match(/<article class="service service--prime">[\s\S]*?<\/article>/)?.[0];
 assert.ok(card);assert.match(card,/<div class="service-body" id="ecosistema">/);
 assert.match(card,/<h3>DESSET <span>prime<\/span><\/h3>/);
 assert.match(read(dir+"styles-service-video.css"),/\.service--prime \.service-body h3\{color:#073bbc/);
 assert.match(read(dir+"styles-service-video.css"),/\.service-body h3 span\{display:block;color:inherit/);
 assert.match(home,/href="#ecosistema">Cómo funciona/);
 assert.match(card,/class="prime-service-cta" href="\.\/prime\.html"/);
 assert.match(prime,/id="modelo"/);assert.match(prime,/class="v6-three-mount"/);assert.match(prime,/class="v6-three-controls"/);
});
test("Browser verifies both wordmark colors and absent redundant chapter",()=>{
 const audit=read("scripts/browser-audit.mjs");
 assert.match(audit,/palette\.primeHeadingColor!==brandBlue\|\|palette\.primeSubtitleColor!==brandBlue/);
 assert.match(audit,/section\.ecosystem,\.prime-3d-heading/);
});
