import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assertClosedAppPage} from "../scripts/app-distribution-contract.mjs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
for(const dir of ["","dist/"])test("APP-CONSUMER-02 approved compact entry, no fake access "+(dir||"source"),()=>{
 const h=read(dir+"aplicaciones-clientes.html");
 assertClosedAppPage(h,"aplicaciones-clientes");
 assert.match(h,/Tu ciudad, en una aplicación\./);
 assert.equal((h.match(/<button[^>]* disabled>/g)||[]).length,3);
 for(const label of ["Abrir DESSET Web","App Store","Google Play","Accesos previstos, todavía no operativos.","Comidas","Mercados","Cafeterías","Tiendas"])assert.ok(h.includes(label),label);
 assert.equal((h.match(/class="consumer-category"/g)||[]).length,4);
 assert.doesNotMatch(h,/data-app-platform=|<form\b|<iframe\b|<video\b|consumer-hero-media|href="https?:/);
 assert.ok(h.includes('href="./confianza.html#privacidad"'));
 assert.ok(h.includes('href="./confianza.html#seguridad"'));
 assert.ok(h.includes('data-app-coverage>No confirmada.'));
 for(const name of ["index","aplicaciones","aplicaciones-comercios","aplicaciones-repartidores","prime"])assert.ok(!read(dir+name+".html").includes("consumer-compact"));
});
