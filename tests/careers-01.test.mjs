import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
for(const dir of ["","dist/"]){
 test("CAREERS-01 corporate culture without collection or invented openings "+(dir||"source"),()=>{
 const html=read(dir+"talento.html"),css=read(dir+"styles-careers.css");
 assert.match(html,/name="robots" content="noindex,nofollow"/);
 assert.match(html,/form-action 'none'/);
 assert.match(html,/no se anuncian vacantes\./);
 assert.match(html,/no se reciben candidaturas\./);
 assert.match(html,/<h1>El futuro lo construyen las personas\.<\/h1>/);
 const hero=html.match(/<section class="ca-hero">[\s\S]*?<\/section>/)[0];
 assert.match(hero,/<img class="ca-hero-photo" src="\.\/assets\/talento-cultura\.webp" width="1200" height="1800" alt="Fotografía referencial de colaboración profesional\." decoding="async" fetchpriority="high">/);
 assert.match(hero,/Una cultura basada en la responsabilidad, el aprendizaje y la capacidad de transformar ideas en soluciones reales\./);
 assert.doesNotMatch(hero,/ca-kicker|<figcaption|<a\b|<button\b|<figure/);
 assert.match(css,/\.ca-hero-photo\{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:50% 40%/);
 assert.match(css,/\.careers-page \.ca-hero::after\{[^}]*linear-gradient\(90deg/);
 assert.match(css,/@media\(max-width:780px\)\{[^}]*align-items:flex-end/);
 assert.match(css,/linear-gradient\(0deg/);
 assert.match(css,/font-family:var\(--ds-type-body\);font-size:clamp\(38px,4\.9vw,72px\);font-weight:900/);
 assert.match(css,/max-width:13em;text-wrap:wrap/);
 assert.match(css,/min-height:clamp\(380px,44\.65vw,640px\)/);
 assert.match(css,/min-height:clamp\(435px,136vw,600px\)/);
 assert.match(css,/max-width:9em;margin-bottom:\.65em/);
 assert.deepEqual([...html.matchAll(/<span>(Innovación con propósito|Excelencia en la ejecución|Responsabilidad compartida|Aprendizaje continuo)<\/span>/g)].map(m=>m[1]),["Innovación con propósito","Excelencia en la ejecución","Responsabilidad compartida","Aprendizaje continuo"]);
 assert.doesNotMatch(html.replace('<script defer src="./scripts/app.js"></script>',""),/<(?:form|input|script|iframe|textarea)\b|mailto:|tel:|https?:\/\/|footer-social|data-footer-channel/i);
 for(const page of ["index","empresa","comercios","repartidores","prime"]){
 const doc=read(dir+page+".html");assert.ok(doc.includes('href="./talento.html">Talento y cultura</a>'));assert.ok(!doc.includes("styles-careers.css"));
 }
 assert.match(read(dir+"contacto.html"),/href="\.\/talento\.html">Conoce Talento y cultura/);
 assert.ok(Buffer.byteLength(css,"utf8")<=3000);
 });
}
