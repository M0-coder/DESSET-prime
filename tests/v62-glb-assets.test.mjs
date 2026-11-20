import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
const root=new URL("../",import.meta.url);
const read=p=>readFileSync(new URL(p,root),"utf8");
function parseGLB(path){
 const bytes=readFileSync(new URL(path,root));
 assert.equal(bytes.subarray(0,4).toString(),"glTF","Missing binary glTF header "+path);
 assert.equal(bytes.readUInt32LE(4),2,"Must be glTF 2.0");
 assert.equal(bytes.readUInt32LE(8),bytes.length,"GLB length mismatch");
 const jsonLength=bytes.readUInt32LE(12),chunkType=bytes.readUInt32LE(16);
 assert.equal(chunkType,0x4e4f534a,"First chunk must be JSON");
 const json=JSON.parse(bytes.subarray(20,20+jsonLength).toString("utf8").trim());
 const bufferHeader=20+jsonLength;
 assert.equal(bytes.readUInt32LE(bufferHeader+4),0x004e4942,"Second chunk must be BIN");
 assert.equal(json.asset.version,"2.0");
 assert.equal(json.buffers.length,1);
 assert.ok(json.bufferViews.length>=10);
 assert.ok(json.accessors.length>=10);
 assert.ok(json.meshes.length>=5&&json.meshes.length<=40);
 assert.ok(json.materials.length>=5);
 assert.ok(!json.extensionsRequired?.length);
 assert.doesNotMatch(JSON.stringify(json),/https?:\/\/|data:[^"]+;base64/);
 assert.ok(bytes.length>15000&&bytes.length<400000);
 return {path,bytes:bytes.length,meshes:json.meshes.length,materials:json.materials.length,
  nodes:json.nodes.length};
}
test("V6.2 creates three independently loadable original binary glTF 2.0 models",()=>{
 const paths=["commerce","courier","destination"].map(x=>"assets/v62-"+x+".glb");
 const models=paths.map(parseGLB);
 assert.ok(models.reduce((a,x)=>a+x.bytes,0)<800000);
 assert.ok(models.reduce((a,x)=>a+x.meshes,0)>=20);
});
test("V6.2 build generates original, material-batched models with no external assets",()=>{
 const source=read("scripts/build-glb-models.mjs"),loader=read("scripts/v62-glb-loader.src.mjs");
 const builder=read("scripts/build-three.mjs"),viewer=read("scripts/v6-three.src.mjs");
 const preview=read("scripts/local-preview.mjs");
 assert.match(source,/new GLTFExporter\(\)/);
 assert.match(source,/mergeGeometries\(geos,false\)/);
 assert.match(source,/new THREE\.MeshStandardMaterial/);
 assert.match(source,/models=\{commerce:commerce\(\),courier:courier\(\),destination:destination\(\)\}/);
 assert.match(builder,/import\("\.\/build-glb-models\.mjs"\)/);
 assert.match(loader,/new GLTFLoader\(\)/);
 assert.match(loader,/Promise\.all\(rows\.map/);
 assert.match(loader,/makeLocalTexture\(pattern,ownedTextures\)/);
 assert.match(loader,/stage\.dataset\.v62ModelsStatus="ready"/);
 assert.match(viewer,/hydrateGLBModels\(/);
 assert.match(viewer,/glbLoaded:modelStats\.ready/);
 assert.match(preview,/model\/gltf-binary/);
 assert.match(preview,/v62-\(\?:commerce\|courier\|destination\)/);
 assert.doesNotMatch(loader,/https?:\/\/|https?:\\\/\\\//);
});
test("V6.2 preserves static fallback, consent and security boundaries",()=>{
 const html=read("index.html"),loader=read("scripts/v5-cinematic.js");
 const source=read("scripts/v6-three.src.mjs");
 assert.match(html,/v5-cinematic-mobile\.webp/);
 assert.match(html,/todavía no realiza pedidos ni entregas comerciales/);
 assert.match(loader,/threeStart\?\.addEventListener\("click",loadThree\)/);
 assert.match(source,/if\(!probe\.getContext\("webgl2"\)\)/);
 assert.match(source,/stage\.dataset\.v6State="active"/);
 assert.match(read(".github/workflows/preview-checks.yml"),/permissions:\s*\n\s*contents:\s*read/);
});
