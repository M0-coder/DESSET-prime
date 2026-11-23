import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const read=p=>readFileSync(new URL(p,root),"utf8");
const generator=read("scripts/build-glb-models.mjs");
const viewer=read("scripts/v6-three.src.mjs");
const loader=read("scripts/v62-glb-loader.src.mjs");
const html=read("index.html");
const storyboard=read("scripts/v63-storyboard.mjs");

test("LOGISTICS-3D-01 replaces all old retail, motorcycle and home GLB geometry",()=>{
 for(const token of ["DESSET-Logistics-Warehouse","DESSET-Logistics-Fleet","DESSET-Loading-Docks"])
  assert.ok(generator.includes(token),"Missing generated warehouse model "+token);
 for(const token of ['create("DESSET-Commerce")','create("DESSET-Courier")','create("DESSET-Destination")'])
  assert.ok(!generator.includes(token),"Legacy geometry remains: "+token);
 assert.match(generator,/const models=\{commerce:commerce\(\),courier:courier\(\),destination:destination\(\)\}/);
 assert.match(generator,/new GLTFExporter\(\)/);
 assert.match(viewer,/LOGISTICS-3D-01/);
 assert.doesNotMatch(viewer,/box\(g,2\.65,2\.12,2\.18/);
 assert.doesNotMatch(viewer,/for\(let i=0;i<7;i\+\+\)box\(g,\.43/);
});

test("LOGISTICS-3D-01 keeps the existing real WebGL and accessible static fallback",()=>{
 assert.match(viewer,/new THREE\.WebGLRenderer\(/);
 assert.match(viewer,/renderer\.render\(scene,camera\)/);
 assert.match(viewer,/hydrateGLBModels\(/);
 assert.match(loader,/new GLTFLoader\(\)/);
 assert.match(html,/CENTRO · FLOTA · MUELLES/);
 assert.match(html,/No corresponde a pedidos ni entregas activas/);
 assert.match(html,/class="v6-static-fallback"/);
 assert.match(storyboard,/title:"CENTRO DE DISTRIBUCIÓN"/);
 assert.match(storyboard,/title:"FLOTA DE TRANSPORTE"/);
 assert.match(storyboard,/title:"MUELLES DE CARGA"/);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
});
