import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const src=readFileSync(new URL("../scripts/v62-glb-loader.src.mjs",import.meta.url),"utf8");
const gpu=readFileSync(new URL("../scripts/v6-gpu-browser-audit.mjs",import.meta.url),"utf8");

test("RENDER-02 applies bounded PBR finishes to three original GLBs",()=>{
 for(const scene of ["commerce","courier","destination"])
  assert.ok(src.includes(scene+":Object.freeze({"),"Missing finish profile for "+scene);
 for(const surface of ["royal","gold","cream","royalDark","rubber","red","glass","stone","steel"])
  assert.ok(src.includes(surface+":"),"Missing finish: "+surface);
 assert.match(src,/tuned\.roughness=profile\.roughness/);
 assert.match(src,/tuned\.metalness=profile\.metalness/);
 assert.match(src,/const materialCache=new Map\(\)/);
 assert.match(src,/for\(const \[original,tuned\] of materialCache\)if\(original!==tuned\)original\.dispose\(\)/);
});
test("RENDER-02 owns one local, linear-data roughness texture",()=>{
 assert.match(src,/canvas\.width=128;canvas\.height=128/);
 assert.match(src,/const roughnessMap=makeLocalRoughnessMap\(ownedTextures\)/);
 assert.match(src,/tuned\.roughnessMap=roughnessMap/);
 assert.match(src,/registry\.push\(map\)/);
 assert.match(src,/map\.anisotropy=1/);
 assert.doesNotMatch(src,/roughnessMap\.colorSpace=THREE\.SRGBColorSpace/);
 assert.doesNotMatch(src,/Math\.random\(|fetch\s*\(|XMLHttpRequest|https?:\/\//);
});
test("RENDER-02 has real desktop/mobile material budget proof",()=>{
 assert.match(gpu,/RENDER-02 three GLB PBR finish profiles and shared linear micrograin/);
 assert.match(gpu,/desktop\.textureCount<=22/);
 assert.match(gpu,/RENDER-02 mobile material finish budget without physical GPU shadows/);
 assert.match(gpu,/mobile\.textureCount<=19&&!mobile\.shadows/);
 assert.match(src,/stage\.dataset\.v62ModelsStatus="fallback"/);
 assert.match(src,/stage\.dataset\.v62ModelsStatus="ready"/);
});
