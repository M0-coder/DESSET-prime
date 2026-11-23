import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const read=path=>readFileSync(new URL(path,root),"utf8");
const src=read("scripts/v6-three.src.mjs");
const gpu=read("scripts/v6-gpu-browser-audit.mjs");
const ci=read(".github/workflows/preview-checks.yml");
const html=read("index.html");
test("V6.1 cinematic material pipeline is true PBR with self-authored 3D signage",()=>{
 assert.match(src,/THREE\.MeshStandardMaterial/);
 assert.match(src,/new THREE\.CanvasTexture\(canvas\)/);
 assert.match(src,/sign\(g,"DESSET"/);
 assert.match(src,/sign\(g,"MUELLES"/);
 assert.match(src,/THREE\.SRGBColorSpace/);
 assert.match(src,/THREE\.ACESFilmicToneMapping/);
 assert.match(src,/new THREE\.DirectionalLight/);
 assert.match(src,/new THREE\.PointLight/);
 assert.match(src,/renderer\.shadowMap\.enabled=!coarse/);
 assert.match(src,/sun\.castShadow=!coarse/);
 assert.match(src,/sun\.shadow\.mapSize\.set\(1024,1024\)/);
 assert.match(src,/renderer\?\.info\.memory\.textures/);
});
test("V6.1 motion and disposal remain finite and progressively enhanced",()=>{
 assert.match(src,/requestAnimationFrame\(render\)/);
 assert.match(src,/cancelAnimationFrame\(raf\)/);
 assert.match(src,/else stop\(\)/);
 assert.match(src,/onControls=\s*e=>/);
 assert.match(src,/controls\.removeEventListener\("click",onControls\)/);
 assert.match(src,/for\(const texture of ownedTextures\)texture\.dispose\(\)/);
 assert.match(src,/mesh\.castShadow=!coarse/);
 assert.match(src,/if\(routeHalo\)routeHalo\.material\.opacity=/);
 assert.match(src,/Math\.min\(window\.devicePixelRatio\|\|1,coarse\?1:1\.4\)/);
 assert.match(html,/aria-label="Renderización gráfica conceptual de DESSET"/);
 assert.doesNotMatch(html,/v5-stage-caption/);
 assert.doesNotMatch(src,/setInterval\s*\(|addEventListener\(["']scroll|fetch\s*\(|WebSocket|localStorage/);
});
test("CI proves actual triangle rendering, expensive features desktop-only and poster recovery",()=>{
 for(const name of ["V6.1 real GPU shadows and painted sign textures","V6.1 desktop geometry and draw call budgets",
  "Mobile suppresses expensive shadow maps but keeps 3D materials","Pause stops the WebGL animation loop",
  "Removed hidden manual camera buttons",
  "WebGL retains one canvas after pause/resume"]){
  assert.ok(gpu.includes(name),"Missing GPU browser check: "+name);
 }
 assert.match(ci,/node scripts\/v6-gpu-browser-audit\.mjs/);
 assert.match(ci,/permissions:\s*\n\s*contents:\s*read/);
 assert.doesNotMatch(ci,/pages:\s*write|id-token:\s*write|wrangler\s+pages\s+deploy/);
});
