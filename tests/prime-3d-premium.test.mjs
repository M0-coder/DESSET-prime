import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const scene=read("scripts/v6-three.src.mjs");
const gpu=read("scripts/v6-gpu-browser-audit.mjs");
const html=read("index.html");
const css=read("styles-v5.css");
const original=JSON.parse(read("config/prime-original-assets.json"));

test("PRIME-3D-03 adds genuine architectural depth without replacing the three registered GLBs",()=>{
 assert.match(scene,/function premiumInfrastructure\(\)/);
 assert.match(scene,/new THREE\.InstancedMesh\(/);
 for(const name of ["prime-premium-hub-details","prime-fleet-wayfinding","prime-yard-wayfinding"])
  assert.ok(scene.includes(name),"Missing independent infrastructure layer: "+name);
 for(const token of ["const skylights=\[-1.95,0,1.95\]","const gates=\[-2.72,-.91,.91,2.72\]","dockBeacons.push\(beacon\)"])
  assert.ok(scene.includes(token),"Missing premium detail contract: "+token);
 assert.match(scene,/premiumInfrastructure\(\);/);
 assert.match(scene,/hydrateGLBModels\(/);
 assert.equal(original.assets.filter(x=>/^assets\/v62-.*\.glb$/.test(x.path)).length,3);
 assert.doesNotMatch(scene,/GLTFExporter|GLBModels\s*=|delete.*v62-/);
});

test("PRIME-3D-03 preserves presentation controls, fallback and no false live tracking",()=>{
 assert.match(scene,/stage\.dataset\.v6State="active"/);
 assert.match(scene,/cancelAnimationFrame\(raf\)/);
 assert.match(scene,/document\.hidden\|\|!onscreen\|\|paused/);
 assert.match(scene,/dockBeacons\[i\]\.scale\.setScalar\(pulse\)/);
 assert.match(html,/CENTRO DE DISTRIBUCIÓN · SIMULACIÓN/);
 assert.match(html,/sin datos reales/);
 assert.match(html,/No corresponde a pedidos ni entregas activas/);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
 assert.doesNotMatch(scene,/fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sendBeacon/);
 assert.match(gpu,/PRIME-3D-03 real premium infrastructure and four conceptual dock beacons/);
 assert.match(gpu,/PRIME-3D-03 premium hub survives mobile GLB hydration/);
 assert.match(css,/\.logistics-hud__card--docks\{right:4%;left:auto;top:30%/);
 assert.match(css,/\.logistics-hud__card--notice\{display:none\}/);
 assert.match(scene,/grid\.material\.opacity=coarse\?\.095:\.075/);
});

test("PRIME-3D-04 truck geometry aligns to actual dock gate positions and moves independently",()=>{
 assert.match(scene,/function buildOperationalFleet\(\)/);
 assert.match(scene,/function updateOperationalFleet\(seconds,isTour\)/);
 assert.match(scene,/const gates=\[-2.72,-.91,.91,2.72\]\.map\(x=>hubX\+x\)/);
 assert.match(scene,/const dockZ=hubZ\+3\.42/);
 assert.match(scene,/archivedFleet\.visible=false/);
 assert.match(scene,/fleetBatches\.push\(\{mesh,offsets\}\)/);
 assert.match(scene,/updateOperationalFleet\(storyElapsed,storyActive\)/);
 assert.match(scene,/easeTraffic\(\(seconds-\.85\)\/2\.25\)/);
 assert.match(scene,/easeTraffic\(\(seconds-5\.65\)\/2\.55\)/);
 assert.match(gpu,/PRIME-3D-04 four independent dock tractors aligned to four gates and original fifth yard unit/);
 assert.match(gpu,/PRIME-3D-04 mobile fleet retains aligned truck gates/);
 for(const status of ["Puerta 01","Puerta 02","Puerta 03","Puerta 04"])
  assert.match(html,new RegExp(status));
 assert.match(html,/Puerta 02<\/span><b>En carga/);
 assert.match(scene,/Loading gate 02 is physically open/);
 assert.match(scene,/overview:\{pos:\[6,10\.8,19\.5\],look:\[0,1,0\]\}/);
});
