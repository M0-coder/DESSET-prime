import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
for(const dir of ["","dist/"]){
 for(const [page,headline,cta] of [["comercios","TU NEGOCIO, MÁS ALLÁ DE SUS PUERTAS","business-pitch-cta"],["repartidores","CADA ENTREGA CONECTA UNA HISTORIA","partner-cta"]]){
 test("Audience page "+page+" presentation and institutional safety ("+(dir||"source")+")",()=>{
 const home=read(dir+"index.html"),html=read(dir+page+".html");
 assert.ok(home.includes('class="'+cta+'" href="./'+page+'.html"'));
 assert.ok(html.includes('<h1 id="audience-title">'+headline+'</h1>'));
 for(const id of ["presentacion","beneficios","modelo","incorporacion","preguntas","canales-oficiales"])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
 assert.equal((html.match(/class="ap-card"/g)||[]).length,3);
 assert.equal((html.match(/class="ap-step"/g)||[]).length,4);
 assert.equal((html.match(/<details>/g)||[]).length,3);
 assert.match(html,/no representa una operación activa/);
 assert.match(html,/cuando estén aprobados/);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
 assert.match(html,/form-action 'none'/);
 assert.doesNotMatch(html.replace('<script defer src="./scripts/app.js"></script>',""),/<(?:form|input|script|iframe)\b/i);
 assert.ok(html.includes('href="./registro-'+page+'.html"'));
 assert.ok(html.includes('href="./styles-audiences.css"'));
 assert.ok(!home.includes("styles-audiences.css"));
 assert.ok(!read(dir+"empresa.html").includes("styles-audiences.css"));
 assert.ok(Buffer.byteLength(read(dir+"styles-audiences.css"),"utf8")<6000);
 assert.doesNotMatch(read(dir+"styles-audiences.css"),/@import\b|url\(\s*['"]?https?:/i);
 });
 }
}
