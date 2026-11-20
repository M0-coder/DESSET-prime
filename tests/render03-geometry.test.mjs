import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const read=path=>readFileSync(new URL(path,root),"utf8");
const builder=read("scripts/build-glb-models.mjs"),gpu=read("scripts/v6-gpu-browser-audit.mjs");
test("RENDER-03 precisely nine selected chamfered volumes, no costly subdivision",()=>{
 assert.match(builder,/const chamferBox=\(w,h,d,name,x,y,z,radius=\.10,rot\)=>/);
 assert.match(builder,/new THREE\.ExtrudeGeometry\(outline,\{depth:h,steps:1,bevelEnabled:false,curveSegments:1\}\)/);
 assert.equal((builder.match(/^\s*chamferBox\([0-9.]/gm)||[]).length,9);
 assert.match(builder,/mesh\.userData\.render03Chamfer=true/);
 assert.doesNotMatch(builder,/RoundedBoxGeometry|SubdivisionModifier|Math\.random/);
});
test("RENDER-03 GLB outputs are deterministic and within strict 760KB budget",()=>{
 const report=JSON.parse(read("reports/quality/v62-glb-assets.json"));
 assert.equal(report.models.length,3);
 assert.deepEqual(report.models.map(x=>x.name),["commerce","courier","destination"]);
 assert.deepEqual(report.models.map(x=>x.chamferedSourceMeshes),[3,3,3]);
 assert.ok(report.totalBytes<760000,"Three GLBs must remain under 760KB");
 for(const m of report.models)assert.ok(m.drawMeshes>=5&&m.drawMeshes<=40&&m.rawBytes<400000);
 assert.match(builder,/mergeGeometries\(geos,false\)/);
 assert.match(builder,/createHash\("sha256"\)/);
});
test("RENDER-03 browser GPU checks enforce bounded geometry and mobile safety",()=>{
 assert.match(gpu,/RENDER-03 geometry uplift and bounded GLB triangles on desktop/);
 assert.match(gpu,/RENDER-03 mobile loads improved 3D geometry without shadows/);
 assert.match(gpu,/desktop\.drawCalls<160&&desktop\.geometryCount<180/);
 assert.match(gpu,/mobile\.drawCalls<160&&!mobile\.shadows/);
 assert.match(builder,/new GLTFExporter\(\)/);
 assert.doesNotMatch(builder,/https?:\/\/|fetch\s*\(|WebSocket|localStorage/);
});
