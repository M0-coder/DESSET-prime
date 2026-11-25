import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
for(const dir of ["","dist/"]){
 test("CAREERS-01 corporate culture without collection or invented openings "+(dir||"source"),()=>{
 const html=read(dir+"talento.html"),css=read(dir+"styles-careers.css");
 assert.match(html,/name="robots" content="noindex,nofollow"/);
 assert.match(html,/form-action 'none'/);
 assert.match(html,/no se anuncian vacantes ni se reciben candidaturas/);
 assert.match(html,/<h1>El futuro lo construyen las personas\.<\/h1>/);
 assert.deepEqual([...html.matchAll(/<span>(Innovación con propósito|Excelencia en la ejecución|Responsabilidad compartida|Aprendizaje continuo)<\/span>/g)].map(m=>m[1]),["Innovación con propósito","Excelencia en la ejecución","Responsabilidad compartida","Aprendizaje continuo"]);
 assert.doesNotMatch(html,/<(?:form|input|script|iframe|textarea)\b|mailto:|tel:|https?:\/\/|footer-social|data-footer-channel/i);
 for(const page of ["index","empresa","comercios","repartidores","prime"]){
 const doc=read(dir+page+".html");assert.ok(doc.includes('href="./talento.html">Talento y cultura</a>'));assert.ok(!doc.includes("styles-careers.css"));
 }
 assert.match(read(dir+"contacto.html"),/href="\.\/talento\.html">Conoce Talento y cultura/);
 assert.ok(Buffer.byteLength(css,"utf8")<=3000);
 });
}
