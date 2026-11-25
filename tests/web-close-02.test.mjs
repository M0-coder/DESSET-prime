import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {institutionalPages,assertInstitutionalNavigation} from "../scripts/institutional-navigation-contract.mjs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
for(const dir of ["","dist/"]){
 test("WEB-CLOSE-02 shared navigation contract in "+(dir||"source"),()=>{
 const home=read(dir+"index.html");
 for(const page of institutionalPages){
 const html=read(dir+page+".html");
 assertInstitutionalNavigation(home,html,page);
 assert.equal((html.match(/id="main-nav"/g)||[]).length,1);
 assert.equal((html.match(/class="menu-button"/g)||[]).length,1);
 assert.ok(html.includes('href="./index.html#soluciones"'));
 assert.ok(html.includes('href="./index.html#ecosistema"'));
 assert.ok(html.includes('href="./index.html#negocios"'));
 assert.doesNotMatch(html,/<form\b|<iframe\b|\bon[a-z]+\s*=/i);
 }
 for(const page of ["prime","en","registro-comercios","incorporacion-comercios","registro-repartidores","incorporacion-repartidores","capacitacion-repartidores","aplicaciones-clientes","aplicaciones-comercios","aplicaciones-repartidores"]){
 const html=read(dir+page+".html");
 assert.doesNotMatch(html,/<script defer src="\.\/scripts\/app\.js"><\/script>/);
 assert.doesNotMatch(html,/class="menu-button"/);
 }
 });
}
test("WEB-CLOSE-02 rejects missing, redirected or extra navigation and scripts",()=>{
 const home=read("index.html"),doc=read("empresa.html");
 for(const mutated of [
 doc.replace('href="./aplicaciones.html">Aplicaciones','href="./empresa.html">Aplicaciones'),
 doc.replace('<script defer src="./scripts/app.js"></script>',''),
 doc.replace('</head>','<script defer src="./scripts/motion.js"></script></head>'),
 doc.replace('href="./index.html#ecosistema"','href="./index.html#negocios"')
 ]){
 assert.notEqual(mutated,doc);assert.throws(()=>assertInstitutionalNavigation(home,mutated,"empresa"));
 }
});
