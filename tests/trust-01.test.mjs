import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
for(const dir of ["","dist/"]){
 test("TRUST-01 five pillars, truthful scope and inactive reporting "+(dir||"source"),()=>{
 const html=read(dir+"confianza.html"),css=read(dir+"styles-trust.css"),headers=read(dir+"_headers");
 assert.deepEqual([...html.matchAll(/<details class="tr-item" id="([^"]+)">/g)].map(m=>m[1]),["seguridad","privacidad","fraudes","incidentes","transparencia"]);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
 assert.match(html,/form-action 'none'/);
 assert.match(html,/Esta información no sustituye una política de privacidad/);
 assert.match(html,/La recepción de reportes aún no está habilitada/);
 assert.match(html,/El alojamiento web puede tratar datos técnicos de conexión/);
 assert.match(html,/href="\.\/contacto\.html#seguridad"/);
 assert.match(headers,/frame-ancestors 'none'/);assert.match(headers,/X-Frame-Options: DENY/);assert.match(headers,/Permissions-Policy: camera=\(\)/);
 assert.doesNotMatch(html,/<(?:form|input|script|iframe|textarea)\b|mailto:|tel:|https?:\/\/|footer-social|data-footer-channel|100% seguro|ISO 27001|SOC 2/i);
 for(const page of ["index","empresa","comercios","repartidores","prime","contacto"]){
 const doc=read(dir+page+".html");assert.ok(doc.includes('href="./confianza.html">Centro de confianza</a>'));assert.ok(!doc.includes("styles-trust.css"));
 }
 assert.ok(Buffer.byteLength(css,"utf8")<=4000);
 });
}
