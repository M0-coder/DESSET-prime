import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const read=path=>readFileSync(new URL(path,root),"utf8");
const glb=read("scripts/build-glb-models.mjs");
const render=read("scripts/v6-three.src.mjs");
const loader=read("scripts/v62-glb-loader.src.mjs");
const html=read("index.html");
const css=read("styles-v5.css");

test("LOGISTICS-3D-02: single central warehouse, four dock gates, five trucks, no annex",()=>{
 assert.match(glb,/DESSET-Logistics-Central-Hub/);
 assert.match(glb,/DESSET-Logistics-Trailer-Fleet/);
 assert.match(glb,/DESSET-Logistics-Yard-Operations/);
 assert.match(glb,/for\(const px of \[-2\.72,-\.91,\.91,2\.72\]\)/);
 assert.match(glb,/for\(const \[i,x,z\] of \[\[0,-1\.55,-\.83\]/);
 assert.match(glb,/buildTruck\(m,1\.08,\.82,\.60,1\)/);
 assert.match(glb,/function buildTruck/);
 assert.doesNotMatch(glb,/DESSET-Loading-Docks|DESSET-Commerce|DESSET-Courier|DESSET-Destination/);
 assert.doesNotMatch(glb,/Industrial annex/);
});
test("LOGISTICS-3D-02: visual fallback matches original 3D architecture and preserves GLB transaction",()=>{
 assert.match(render,/LOGISTICS-3D-02/);
 assert.match(render,/function previewTruck/);
 assert.match(render,/for\(const px of \[-2\.72,-\.91,\.91,2\.72\]\)/);
 assert.match(render,/new THREE\.RingGeometry/);
 assert.match(render,/logisticsSensors\.push\(ring\)/);
 assert.match(render,/ring\.material\.opacity/);
 assert.match(render,/new THREE\.WebGLRenderer/);
 assert.match(render,/hydrateGLBModels/);
 assert.match(loader,/GLTFLoader/);
 assert.match(loader,/sign\(parent,"DESSET Prime",0,2\.72,1\.91,3\.00,\.29/);
});
test("LOGISTICS-3D-02: floating dashboard is simulation-only and invisible without verified GPU",()=>{
 assert.match(html,/class="logistics-hud" aria-hidden="true"/);
 assert.match(html,/NOTIFICACIÓN SIMULADA/);
 assert.match(html,/CENTRO DE DISTRIBUCIÓN · SIMULACIÓN/);
 assert.match(html,/sin datos reales/);
 assert.match(html,/No corresponde a pedidos ni entregas activas/);
 assert.match(css,/\.logistics-hud\{position:absolute;inset:0;z-index:5;pointer-events:none;opacity:0;visibility:hidden/);
 assert.match(css,/data-v6-state="active"\] \.logistics-hud\{opacity:1;visibility:visible/);
 assert.match(css,/data-v6-paused="true"\] \.logistics-hud__card/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\s*\.logistics-hud\{display:none!important\}/);
 assert.match(render,/stage\.dataset\.v6Paused=String\(paused\)/);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
});
