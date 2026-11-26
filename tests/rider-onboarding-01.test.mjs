import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const pages=["registro-repartidores","incorporacion-repartidores","capacitacion-repartidores"];
for(const dir of ["","dist/"]){
 test("Rider routes are informational, inactive and local "+(dir||"source"),()=>{
 const landing=read(dir+"repartidores.html");
 for(const name of pages){
  assert.ok(landing.includes('href="./'+name+'.html"'));
  const doc=read(dir+name+".html");
  assert.match(doc,/name="robots" content="noindex,nofollow"/);
  assert.match(doc,/form-action 'none'/);
  assert.doesNotMatch(doc,/<(?:form|script|iframe|object|embed)\b|https?:\/\/|mailto:|tel:|\bon[a-z]+\s*=/i);
  assert.match(doc,/class="ob-notice"/);
  assert.match(doc,/href="\.\/repartidores.html"/);
  for(const m of doc.matchAll(/<(?:input|textarea|button|select)\b[^>]*>/g))assert.match(m[0],/\bdisabled\b/);
 }
 const reg=read(dir+pages[0]+".html");
 assert.equal((reg.match(/<fieldset disabled/g)||[]).length,2);
 assert.match(reg,/no se envía ni almacena información/);
 assert.doesNotMatch(reg,/Opciones ilustrativas|Modelo de prerregistro|<option>(?:Lima|Huaura|Huacho)<\/option>/i);
 assert.doesNotMatch(reg,/\btype="file"|id="(?:dni|cuenta-bancaria|licencia|foto)"/);
 for(const v of ["Bicicleta","Motocicleta","Automóvil"])assert.ok(reg.includes("<option>"+v+"</option>"));
 });
 test("Rider guide and training explicitly distinguish approval from activation "+(dir||"source"),()=>{
 const guide=read(dir+pages[1]+".html"),training=read(dir+pages[2]+".html");
 assert.equal((guide.match(/<li><h2>/g)||[]).length,7);
 assert.match(guide,/Contratación y condiciones/);
 assert.match(guide,/Configuración del acceso/);
 assert.match(guide,/disponibilidad de demanda/);
 assert.match(guide,/No envíes documentos de identidad/);
 assert.equal((training.match(/<details>/g)||[]).length,5);
 assert.match(training,/no se emiten certificaciones/);
 assert.match(training,/no equivale a aprobar la capacitación/);
 assert.doesNotMatch(read(dir+"comercios.html"),/registro-repartidores|incorporacion-repartidores|capacitacion-repartidores/);
 });
}
