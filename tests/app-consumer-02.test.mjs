import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assertClosedAppPage} from "../scripts/app-distribution-contract.mjs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
for(const dir of ["","dist/"])test("APP-CONSUMER-02 scoped landing and truthful prelaunch states "+(dir||"source"),()=>{
 const h=read(dir+"aplicaciones-clientes.html"),css=read(dir+"styles-applications.css");
 assertClosedAppPage(h,"aplicaciones-clientes");
 assert.ok(h.includes('class="apps-page consumer-page"'));
 assert.equal((h.match(/<section class="consumer-section/g)||[]).length,7);
 assert.equal((h.match(/class="consumer-category"/g)||[]).length,4);
 assert.equal((h.match(/<details>/g)||[]).length,6);
 assert.equal((h.match(/data-app-role="clientes"/g)||[]).length,1);
 for(const marker of ["data-app-activation>No habilitada.","data-app-coverage>No confirmada.","data-app-download>Descarga no disponible.","data-app-platforms hidden","data-app-links hidden","Las operaciones comerciales se realizarán dentro de la aplicación"])assert.ok(h.includes(marker),marker);
 for(const a of h.matchAll(/href="#([^"]+)"/g))assert.ok(h.includes('id="'+a[1]+'"'));
 assert.doesNotMatch(h,/<form\b|<input\b|<iframe\b|href="https?:|\bMcDonald|Demae-can|23,000|100,000/i);
 assert.ok(css.includes(".apps-page.consumer-page .consumer-hero"));
 for(const name of ["index","aplicaciones","aplicaciones-comercios","aplicaciones-repartidores","prime"])assert.ok(!read(dir+name+".html").includes("consumer-page"));
});
