import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
const root=new URL("../",import.meta.url);
const read=p=>readFileSync(new URL(p,root),"utf8");
const manifest=JSON.parse(read("dist/site-manifest.json"));
const html=read("dist/index.html");
const loader=read("dist/scripts/v5-cinematic.js");
const workflow=read(".github/workflows/preview-checks.yml");
test("V6.4 packages the actual Prime website, not only an isolated GPU demo",()=>{
 assert.equal(manifest.schema,"desset-prime-static-web-package-v1");
 assert.equal(manifest.domain,"none");
 assert.equal(manifest.noindex,true);
 for(const file of ["index.html","styles.css","styles-v5.css","styles-system.css","_headers",
  "scripts/app.js","scripts/motion.js","scripts/v5-cinematic.js","scripts/service-state.js",
  "assets/v6-three.bundle.js","assets/v62-commerce.glb",
  "assets/v62-courier.glb","assets/v62-destination.glb"]){
  assert.ok(manifest.files.some(x=>x.path===file),"Not packed: "+file);
  assert.ok(statSync(new URL("dist/"+file,root)).size>0,"Missing: "+file);
 }
});
test("V6.4 hero CTA launches the Three.js GLB journey in the ecosystem section",()=>{
 assert.ok(html.includes('href="#ecosistema" data-v64-tour-launch'));
 assert.ok(html.includes('id="ecosistema"'));
 assert.ok(html.includes('class="v6-three-mount" aria-hidden="true"'));
 assert.ok(html.includes('class="v63-tour"'));
 assert.ok(loader.includes('stage.dataset.v64Requested="tour"'));
 assert.ok(loader.includes('stage.querySelector(".v63-tour")?.click()'));
 assert.ok(loader.includes('threeStart?.addEventListener("click",loadThree)'));
 assert.ok(loader.includes('if(threeStart)threeStart.hidden=false'));
 assert.ok(!loader.includes('trigger3D.observe'));
 assert.ok(html.includes('name="robots" content="noindex,nofollow"'));
});
test("V6.4 CI builds and tests the packaged website, without a deployment workflow",()=>{
 for(const str of ["npm run pack:site","npm run verify:site",
   "DESSET_PRIME_WEB_ROOT=dist node scripts/v6-gpu-browser-audit.mjs",
   "DESSET_PRIME_WEB_ROOT=dist node scripts/v54-http-security.mjs",
   "DESSET_PRIME_WEB_ROOT=dist node scripts/local-preview.mjs",
   "            dist/","permissions:\n  contents: read"])
  assert.ok(workflow.includes(str),"Missing CI verification: "+str);
 assert.doesNotMatch(workflow,/pages:\s*write|id-token:\s*write|wrangler pages deploy|vercel deploy/);
 assert.equal(read("dist/_headers"),read("_headers"));
});
