import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
for(const dir of ["","dist/"]){
 test("CONTACT-04 nine institutional categories without fake channels "+(dir||"source"),()=>{
 const html=read(dir+"contacto.html"),css=read(dir+"styles-contact.css");
 const ids=["alianzas","inversion","marketing","prensa","instituciones","profesionales","legal","seguridad","otras"];
 assert.deepEqual([...html.matchAll(/<details class="ct-item" id="([^"]+)">/g)].map(m=>m[1]),ids);
 assert.equal((html.match(/aún no está habilitado/g)||[]).length,9);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
 assert.match(html,/form-action 'none'/);
 assert.doesNotMatch(html.replace('<script defer src="./scripts/app.js"></script>',""),/<(?:form|input|script|iframe|textarea)\b|mailto:|tel:|https?:\/\/|footer-social|data-footer-channel/i);
 assert.match(html,/no recibe mensajes ni datos personales/);
 for(const page of ["index","empresa","comercios","repartidores","prime"]){
 const doc=read(dir+page+".html");assert.ok(doc.includes('href="./contacto.html">Contacto</a>'));assert.ok(!doc.includes("styles-contact.css"));
 }
 assert.ok(read(dir+"index.html").includes('class="nav-contact" href="./contacto.html">Canales DESSET</a>'));
 assert.ok(Buffer.byteLength(css,"utf8")<=3000);
 });
}
