import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
for(const dir of ["","dist/"]){
 test("MERCHANT-01 informational journey, no active commerce or data collection ("+(dir||"source")+")",()=>{
  const home=read(dir+"index.html"),merchant=read(dir+"comercios.html");
  assert.match(home,/class="business-pitch-cta" href="\.\/comercios\.html"/);
  assert.match(home,/class="partner-cta" href="#contacto"/);
  assert.match(merchant,/<h1>Comercios<\/h1>/);
  for(const id of ["modelo","preparacion","condiciones","incorporacion","preguntas","canales-oficiales"])assert.equal((merchant.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
  assert.match(merchant,/no una operación activa/);
  assert.match(merchant,/Las comisiones, zonas de cobertura, liquidaciones y responsabilidades se comunicarán cuando estén aprobadas/);
  assert.match(merchant,/no recibe solicitudes de alta, documentación, pedidos ni pagos/);
  assert.match(merchant,/name="robots" content="noindex,nofollow"/);
  assert.match(merchant,/form-action 'none'/);
  assert.doesNotMatch(merchant,/<(?:form|input|script|iframe)\b/i);
  assert.match(merchant,/href="#canales-oficiales"/);
 });
}
