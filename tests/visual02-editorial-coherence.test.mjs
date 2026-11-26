import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
const root=new URL("../",import.meta.url),read=x=>readFileSync(new URL(x,root),"utf8");
const html=read("index.html"),css=read("styles-visual02.css"),
      build=read("scripts/build-site.mjs"),verify=read("scripts/verify-site-package.mjs"),
      gate=read("scripts/static-gate.mjs"),preview=read("scripts/local-preview.mjs"),
      audit=read("scripts/browser-audit.mjs");
const visual02Css=css.split("/* VISUAL-03:")[0];
assert.ok(css.includes("/* VISUAL-03:"),"Must retain isolated VISUAL-03 marker");
test("VISUAL-02 leaves the approved photographic hero and real official identity untouched",()=>{
 assert.match(html,/desset-hero-entrega-dos-espejos\.webp/);
 assert.match(html,/desset-hero-entrega-mobile\.webp/);
 assert.match(html,/motocicleta de dos espejos/);
 assert.match(html,/deliver-assets-mark\.png/);
 assert.match(html,/Hablemos de tu negocio/);
 assert.match(readFileSync(new URL("../prime.html",import.meta.url),"utf8"),/Representación conceptual/);
 assert.doesNotMatch(html,/APLICACIONES DESSET|Acceso público no habilitado|data-service-access|data-app-links/);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
 assert.doesNotMatch(html,/IDEAS EN ACCIÓN|<form\b|<video\b/);
});
test("VISUAL-02 concentrates editorial retouching below hero, no image, typeface or animation replacements",()=>{
 assert.ok(css.startsWith("/* VISUAL-02"));
 for(const section of ["#vision","#soluciones","#ecosistema","#negocios","#contacto"])
  assert.ok(css.includes(section),"Unstyled chapter "+section);
 assert.match(css,/#negocios \.business-pitch\{border-top:5px solid var\(--v02-gold\)/);
 assert.match(css,/#vision \.motion-story-art img\{filter:drop-shadow\(0 12px 18px/);
 assert.match(css,/#soluciones \.solutions-grid \.service--main\{border:1px solid/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.doesNotMatch(visual02Css,/#inicio|\.prime-photo-image|\.brand-mark|(?:@import|url\(|@font-face|@keyframes|animation:)/);
 assert.ok(statSync(new URL("styles-visual02.css",root)).size<=8200);
});
test("VISUAL-02 ships a single budgeted local stylesheet in source and packaged dist",()=>{
 assert.match(html,/href="\.\/styles-hero-photo\.css">\s*<link rel="stylesheet" href="\.\/styles-visual02\.css"/);
 assert.match(build,/"styles-hero-photo\.css","styles-visual02\.css"/);
 assert.match(build,/hero-photo\|-visual02/);
 assert.match(gate,/visual02_css_bytes:8200/);
 assert.match(gate,/styles-visual02\.css/);
 assert.match(preview,/rel==="styles-visual02\.css"/);
 assert.match(verify,/VISUAL-02 editorial stylesheet missing/);
 assert.match(audit,/VISUAL-02 corporate style, approved hero and responsive safety/);
 const dist=read("dist/index.html");
 assert.match(dist,/href="\.\/styles-visual02\.css"/);
 assert.equal(read("dist/styles-visual02.css"),css);
 const manifest=JSON.parse(read("dist/site-manifest.json"));
 assert.ok(manifest.files.some(x=>x.path==="styles-visual02.css"));
 assert.equal(manifest.domain,"none");
 assert.equal(manifest.noindex,true);
});
test("VISUAL-02 has no hidden deployment or remote resources",()=>{
 assert.doesNotMatch(css,/https?:\/\/[^" ]+\.css|@import/);
 assert.match(gate,/Remote CSS dependency/);
 assert.match(preview,/const host="127\.0\.0\.1"/);
 assert.doesNotMatch(visual02Css,/display:\s*none|visibility:\s*hidden|overflow:\s*hidden|opacity:\s*0(?:[;}])/);
});
