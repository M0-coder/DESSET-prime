import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
for(const dir of ["","dist/"]){
 test("NEWS-01 editorial archive and honest brand availability "+(dir||"source"),()=>{
 const html=read(dir+"noticias.html"),css=read(dir+"styles-news.css");
 assert.deepEqual([...html.matchAll(/<input type="radio" id="([^"]+)" name="categoria"/g)].map(m=>m[1]),["nw-all","nw-press","nw-announcements","nw-media"]);
 assert.equal((html.match(/<div class="nw-state /g)||[]).length,4);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
 assert.match(html,/form-action 'none'/);
 assert.match(html,/No hay comunicados oficiales publicados/);
 assert.match(html,/No hay anuncios oficiales publicados/);
 assert.match(html,/No hay apariciones en medios publicadas/);
 assert.match(html,/ni constituye una licencia de uso/);
 const brand=html.match(/<details class="nw-brand"[\s\S]*?<\/details>/)?.[0];assert.ok(brand);
 assert.match(brand,/se reservan para colaboradores autorizados/);assert.match(brand,/El canal de solicitudes aún no está habilitado/);
 assert.doesNotMatch(brand,/<img\b|<a\b[^>]*(?:download|href="\.\/assets\/)|<input\b/i);
 assert.match(html,/href="\.\/contacto\.html#prensa"/);
 assert.doesNotMatch(html.replace('<script defer src="./scripts/app.js"></script>',""),/<(?:form|script|iframe|textarea|article|time)\b|mailto:|tel:|https?:\/\/|footer-social|data-footer-channel|\bdownload\b/i);
 for(const page of ["index","empresa","comercios","repartidores","prime","contacto","confianza"]){
 const doc=read(dir+page+".html");assert.ok(doc.includes('href="./noticias.html">Sala de noticias</a>'));assert.ok(!doc.includes("styles-news.css"));
 }
 assert.ok(Buffer.byteLength(css,"utf8")<=4500);
 });
}
