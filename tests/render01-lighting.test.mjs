import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const src=readFileSync(new URL("../scripts/v6-three.src.mjs",import.meta.url),"utf8");
const gpu=readFileSync(new URL("../scripts/v6-gpu-browser-audit.mjs",import.meta.url),"utf8");

test("RENDER-01 replaces hard-edged ground circles with a bounded local light falloff",()=>{
 assert.match(src,/lampCanvas\.width=128;lampCanvas\.height=128/);
 assert.match(src,/createRadialGradient\(64,64,2,64,64,63\)/);
 assert.match(src,/new THREE\.CanvasTexture\(lampCanvas\)/);
 assert.match(src,/ownedTextures\.push\(render01FloorTexture\)/);
 assert.match(src,/new THREE\.PlaneGeometry\(r\*2,r\*2\)/);
 assert.match(src,/render01FloorTexture\?\.38:\.07/);
 assert.match(src,/halo\.name="render01-floor-pool"/);
 assert.match(src,/mass\.name="render01-background-mass"/);
 assert.match(src,/mass\.castShadow=false;mass\.receiveShadow=false/);
 assert.match(src,/renderer\.toneMappingExposure=1\.07/);
 for(const color of ["0x447bff","PAL.gold","0xff6852"])assert.ok(src.includes(color));
 assert.doesNotMatch(src,/new THREE\.EffectComposer|UnrealBloomPass|WebGLMultipleRenderTargets/);
});

test("RENDER-01 preserves 3D fallback, pause, shadow and adaptive mobile budgets",()=>{
 assert.match(src,/const geometry=render01FloorTexture\?new THREE\.PlaneGeometry/);
 assert.match(src,/renderer\.shadowMap\.enabled=!coarse/);
 assert.match(src,/if\(document\.hidden\|\|!onscreen\|\|paused\)return/);
 assert.match(src,/for\(const texture of ownedTextures\)texture\.dispose\(\)/);
 assert.match(src,/if\(!probe\.getContext\("webgl2"\)\)/);
 assert.match(src,/Math\.min\(window\.devicePixelRatio\|\|1,coarse\?1:1\.4\)/);
 assert.match(gpu,/RENDER-01 desktop local cinematic floor lighting/);
 assert.match(gpu,/RENDER-01 mobile reuses local floor lighting without shadow maps/);
});
