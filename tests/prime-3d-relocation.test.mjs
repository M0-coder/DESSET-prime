import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
for(const dir of ["","dist/"])test("Prime exclusively owns the logistics scene; home contains neutral text roles "+(dir||"source"),()=>{
 const home=read(dir+"index.html"),prime=read(dir+"prime.html"),css=read(dir+"styles-visual02.css");
 assert.doesNotMatch(home,/v6-three-mount|v5-city-stage|roles-geometry-/);
 assert.match(home,/href="\.\/prime\.html#modelo"/);
 assert.equal((home.match(/role="listitem"/g)||[]).length>=4,true);
 const flow=prime.match(/<section class="pr-flow" id="modelo">[\s\S]*?<\/section>/)?.[0];
 assert.ok(flow);assert.match(flow,/Cada movimiento cuenta/);assert.equal((flow.match(/class="v6-three-mount"/g)||[]).length,1);
 assert.match(flow,/v6-static-fallback/);assert.match(flow,/v63-tour/);assert.match(flow,/simulaciones/);
 assert.match(prime,/src="\.\/scripts\/v5-cinematic\.js"/);
 assert.match(css,/#ecosistema \.v4-architecture-inner\{background:#fff\}/);
 assert.match(prime,/name="robots" content="noindex,nofollow"/);
});
