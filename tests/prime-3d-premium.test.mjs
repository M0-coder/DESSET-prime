import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const scene=read("scripts/v6-three.src.mjs");
const gpu=read("scripts/v6-gpu-browser-audit.mjs");
const html=read("index.html");
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
});
