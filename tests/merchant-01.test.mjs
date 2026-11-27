import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
for(const dir of ["","dist/"]){
 for(const [page,headline,cta] of [["comercios","TU NEGOCIO, MÁS ALLÁ DE SUS PUERTAS","business-pitch-cta"],["repartidores","CADA ENTREGA CONECTA UNA HISTORIA","partner-cta"]]){
 test("Audience page "+page+" presentation and institutional safety ("+(dir||"source")+")",()=>{
 const home=read(dir+"index.html"),html=read(dir+page+".html");
 assert.ok(home.includes('class="'+cta+'" href="./'+page+'.html"'));
 assert.equal(html.match(/<h1 id="audience-title">([\s\S]*?)<\/h1>/)?.[1].replace(/<[^>]+>/g,''),headline);
 for(const id of ["presentacion","beneficios","modelo","incorporacion","preguntas","canales-oficiales"])assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
 assert.equal((html.match(/class="ap-card"/g)||[]).length,3);
 assert.equal((html.match(/class="ap-step"/g)||[]).length,4);
 assert.equal((html.match(/<details>/g)||[]).length,6);
 if(page==="comercios"){
  const hero=html.match(/<section class="ap-hero[^"]*"[^>]*>[\s\S]*?<\/section>/)[0];
  const flow=html.match(/<section class="ap-block ap-flow"[^>]*>[\s\S]*?<\/section>/)[0];
  assert.doesNotMatch(hero,/<(?:p|figcaption)\b|No implica afiliación|DESSET \/ Comercios|Comercio digital, tecnología/);
  assert.match(hero,/alt="Fotografía referencial de la fachada de un mercadito/);
  assert.equal((hero.match(/class="ap-button"/g)||[]).length,2);
  assert.doesNotMatch(flow,/<strong>|Recorrido conceptual|class="ap-note"/);
  assert.match(read(dir+"styles-audiences.css"),/\.audience-page--comercios \.ap-step\{border-top:0;/);
  assert.match(html,/No se anuncia disponibilidad comercial activa en este sitio/);
  const main=html.match(/<main\b[^>]*>[\s\S]*?<\/main>/)[0];
  assert.deepEqual([...main.matchAll(/<section\b[^>]*id="([^"]+)"/g)].map(x=>x[1]),["presentacion","beneficios","categorias","modelo","condiciones","aplicacion","incorporacion","preguntas","cierre-comercial"]);
  assert.equal((html.match(/<dd>Pendiente de aprobación<\/dd>/g)||[]).length,4);
  assert.match(html,/href="\.\/aplicaciones-comercios\.html"/);
  assert.match(html,/Aplicación prevista · Descarga no disponible/);
  assert.equal((html.match(/<figure class="ap-hero-image">/g)||[]).length,1);
  assert.doesNotMatch(html,/<video\b/);
 }else {assert.match(html,/no representa una operación activa/);const hero=html.match(/<section class="ap-hero ap-hero--rider-photo"[^>]*>[\s\S]*?<\/section>/)[0];assert.ok(hero.includes('src="./assets/repartidores-hero-original.jpg"'));assert.doesNotMatch(hero,/<(?:p|figcaption)\b/);assert.equal((hero.match(/class="ap-button"/g)||[]).length,1);assert.match(hero,/href="#modelo">Conoce el modelo/);
  const main=html.match(/<main\b[^>]*>[\s\S]*?<\/main>/)[0];
  assert.deepEqual([...main.matchAll(/<section\b[^>]*id="([^"]+)"/g)].map(x=>x[1]),["presentacion","beneficios","vehiculos","modelo","requisitos","condiciones","aplicacion","academia","incorporacion","preguntas","cierre-comercial"]);
  assert.equal((main.match(/<dd>Pendiente de aprobación<\/dd>/g)||[]).length,4);
  assert.match(main,/href="\.\/aplicaciones-repartidores\.html"/);
  assert.match(main,/href="\.\/capacitacion-repartidores\.html"/);
  assert.match(main,/Aplicación prevista · Descarga no disponible/);
  assert.match(main,/sin certificaciones activas/);
  assert.match(main,/No se garantizan ingresos ni volumen de entregas/);
  assert.equal((main.match(/<img\b/g)||[]).length,1);
  assert.doesNotMatch(main,/<video\b/);
 }
 assert.match(html,page==="comercios"?/Las condiciones económicas se comunicarán cuando estén aprobadas\./:/cuando estén aprobados/);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
 assert.match(html,/form-action 'none'/);
 assert.doesNotMatch(html.replace('<script defer src="./scripts/app.js"></script>',""),/<(?:form|input|script|iframe)\b/i);
 assert.ok(html.includes('href="./registro-'+page+'.html"'));
 assert.ok(html.includes('href="./styles-audiences.css"'));
 assert.ok(!home.includes("styles-audiences.css"));
 assert.ok(!read(dir+"empresa.html").includes("styles-audiences.css"));
 assert.ok(Buffer.byteLength(read(dir+"styles-audiences.css"),"utf8")<=18000);
 assert.doesNotMatch(read(dir+"styles-audiences.css"),/@import\b|url\(\s*['"]?https?:/i);
 });
 }
}
