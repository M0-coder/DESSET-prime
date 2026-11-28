import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const read=p=>readFileSync(new URL("../"+p,import.meta.url));
for(const dir of ["","dist/"])test("APP-IDENTITY-01 exact approved icon, name and closed distribution "+(dir||"source"),()=>{
 const svg=read(dir+"assets/desset-app-icon.svg");assert.equal(svg.length,22423);assert.equal(createHash("sha256").update(svg).digest("hex"),"85416a7648aa4e772d987febb8cbf832b0d3539feec6555e7b110277e5d65727");
 for(const [name,heading] of [["aplicaciones",'aria-label="DESSET" data-app-role="clientes"'],["aplicaciones-clientes",'<h1 id="consumer-title">Tu ciudad, en una aplicación.</h1>']]){
 const h=read(dir+name+".html").toString();assert.ok(h.includes(heading));assert.equal(h.split('src="./assets/desset-app-icon.svg"').length,2);assert.ok(h.includes('data-app-role="clientes"'));assert.ok(h.includes("Descarga no disponible."));assert.ok(h.includes('name="robots" content="noindex,nofollow"'));if(name==="aplicaciones"){assert.ok(h.includes('src="./assets/deliver-assets-mark.png"'));assert.match(h,/<a class="apps-icon apps-icon-desset" href="\.\/aplicaciones-clientes\.html" aria-label="DESSET" data-app-role="clientes"><img[^>]+><span hidden data-app-download>Descarga no disponible\.<\/span><\/a>/);assert.doesNotMatch(h,/data-app-country|País de consulta|class="apps-card"|class="apps-status"|Compras y pedidos\.|Conocer DESSET|Conocer acceso para/);const launcher=h.match(/<nav class="apps-launcher"[^>]*>([\s\S]*?)<\/nav>/)?.[1];assert.ok(launcher);assert.equal((launcher.match(/<a\b/g)||[]).length,3);for(const role of ["clientes","comercios","repartidores"])assert.ok(launcher.includes('href="./aplicaciones-'+role+'.html"'));}else assert.ok(h.includes('class="consumer-brand" href="./index.html"'));
 }
 for(const name of ["index","aplicaciones-comercios","aplicaciones-repartidores"])assert.ok(!read(dir+name+".html").toString().includes("assets/desset-app-icon.svg"));
});
