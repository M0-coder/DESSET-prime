import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
test("institutional contact distinguishes app orientation from active correspondence",()=>{
 const html=read("contacto.html");
 assert.match(html,/esta página no recibe mensajes ni datos personales/);
 for(const role of ["clientes","comercios","repartidores"])assert.ok(html.includes('href="./aplicaciones-'+role+'.html"'));
 assert.doesNotMatch(html,/<form\b|mailto:|tel:/i);
 assert.match(html,/form-action 'none'/);
});
test("unpublished app store access and business incorporation never claim operational availability",()=>{
 for(const name of ["clientes","comercios"]){
  const html=read("aplicaciones-"+name+".html");
  assert.match(html,/Accesos previstos, todavía no operativos/);
  assert.match(html,/<button type="button" disabled><span>Previsto en<\/span><strong>Google Play/);
  assert.match(html,/<button type="button" disabled><span>Previsto en<\/span><strong>App Store/);
  assert.doesNotMatch(html,/href="\.\/contacto\.html">Ayuda<\/a>/);
 }
 assert.match(read("registro-comercios.html"),/el proceso de incorporación se realizará mediante la aplicación/);
 assert.match(read("registro-repartidores.html"),/la gestión se realizará mediante la aplicación cuando esté habilitada/);
});
