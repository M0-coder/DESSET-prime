import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
const root=new URL("../",import.meta.url);
const read=p=>readFileSync(new URL(p,root),"utf8");
const html=read("index.html"),css=read("styles-v5.css");
const loader=read("scripts/v5-cinematic.js");
const gpu=read("scripts/v6-three.src.mjs");
const build=read("scripts/build-three.mjs");
const selfHosted=read("assets/v6-three.bundle.js");
const project=JSON.parse(read("package.json"));
const workflow=read(".github/workflows/preview-checks.yml");

test("V6 really uses Three.js and WebGLRenderer, not CSS-only 2.5D",()=>{
 assert.match(gpu,/import \* as THREE from "three"/);
 assert.match(gpu,/new THREE\.WebGLRenderer/);
 assert.match(gpu,/new THREE\.Scene/);
 assert.match(gpu,/new THREE\.OrthographicCamera/);
 assert.match(gpu,/new THREE\.BoxGeometry/);
 assert.match(gpu,/new THREE\.TubeGeometry/);
 assert.match(gpu,/new THREE\.DirectionalLight/);
 assert.match(gpu,/renderer\.render\(scene,camera\)/);
 assert.match(gpu,/THREE\.REVISION/);
 assert.match(gpu,/renderer\?\.info\.render\.triangles/);
 assert.match(workflow,/node scripts\/v6-gpu-browser-audit\.mjs/);
});
test("V6 remains self-hosted, reproducibly pinned and within byte budgets",()=>{
 assert.equal(project.dependencies.three,"0.187.0");
 assert.equal(project.devDependencies.esbuild,"0.28.2");
 assert.match(build,/format:"iife"/);
 assert.match(build,/bundle:true/);
 assert.match(build,/gzipBytes>190000/);
 assert.ok(statSync(new URL("assets/v6-three.bundle.js",root)).size>80000);
 assert.ok(statSync(new URL("assets/v6-three.bundle.js",root)).size<750000);
 assert.doesNotMatch(selfHosted,/\bimport\s*\(/);
 assert.doesNotMatch(html,/https?:\/\/[^\s"']+\.(?:js|css)/);
 assert.match(workflow,/npm ci --ignore-scripts/);
 assert.match(workflow,/npm run build:3d/);
});
test("V6 has real input controls, opt-in mobile loading and permanent poster fallback",()=>{
 assert.match(html,/class="v6-three-mount" aria-hidden="true"/);
 assert.match(html,/class="v6-three-controls" role="group"/);
 for(const view of ["overview","commerce","destination"])
  assert.match(html,new RegExp('data-v6-camera="'+view+'"'));
 assert.match(html,/class="v6-enable-webgl" type="button" hidden/);
 assert.match(html,/class="v6-pause"/);
 assert.match(html,/class="v6-poster"/);
 assert.match(loader,/document\.createElement\("script"\)/);
 assert.match(loader,/\.\/assets\/v6-three\.bundle\.js/);
 assert.match(loader,/threeStart\?\.addEventListener\("click",loadThree\)/);
 assert.match(loader,/if\(threeStart\)threeStart.hidden=false/);
 assert.doesNotMatch(loader,/trigger3D|trigger3D\.observe/);
 assert.match(gpu,/getContext\("webgl2"\)/);
 assert.match(gpu,/stage\.dataset\.v6State="active"/);
 assert.match(gpu,/stage\.dataset\.v6State=reason/);
 assert.match(css,/\.v5-city-stage\[data-v6-state="active"\] \.v5-responsive-art/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(gpu,/document\.hidden\|\|!onscreen\|\|paused/);
 assert.match(gpu,/cancelAnimationFrame\(raf\)/);
});
test("V6 does not falsify service status or introduce external transport or deployment",()=>{
 assert.match(html,/todavía no realiza pedidos ni entregas comerciales/);
 assert.match(html,/no procesa pedidos ni pagos/);
 assert.match(html,/noindex,nofollow/);
 assert.doesNotMatch(gpu,/fetch\s*\(|\bXMLHttpRequest\b|sendBeacon|localStorage|sessionStorage|WebSocket/);
 assert.doesNotMatch(gpu,/https?:\/\/[^\s"']+/);
 assert.doesNotMatch(workflow,/pages:\s*write|id-token:\s*write|wrangler pages deploy|vercel deploy/);
});
