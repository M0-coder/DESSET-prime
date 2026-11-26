import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
for(const dir of ["","dist/"])test("Prime exclusively owns the logistics scene; home retains a direct model link without duplicate roles "+(dir||"source"),()=>{
 const home=read(dir+"index.html"),prime=read(dir+"prime.html"),css=read(dir+"styles-visual02.css");
 assert.doesNotMatch(home,/v6-three-mount|v5-city-stage|roles-geometry-/);
 assert.match(home,/href="\.\/prime\.html#modelo"/);
 assert.doesNotMatch(home,/v4-architecture-details|ecosystem-board v4-flow-board|class="roles" role="list"/);
 const flow=prime.match(/<section class="pr-flow" id="modelo">[\s\S]*?<\/section>/)?.[0];
 assert.ok(flow);assert.match(flow,/Cada movimiento cuenta/);assert.equal((flow.match(/class="v6-three-mount"/g)||[]).length,1);
 assert.match(flow,/v6-static-fallback/);assert.match(flow,/v63-tour/);assert.match(flow,/simulaciones/);
 assert.match(prime,/src="\.\/scripts\/v5-cinematic\.js"/);
 assert.doesNotMatch(home,/<section class="ecosystem"|id="desset-prime-heading"|class="prime-3d-heading"/);assert.match(home,/class="service-body" id="ecosistema"/);
 assert.match(prime,/name="robots" content="noindex,nofollow"/);
});
