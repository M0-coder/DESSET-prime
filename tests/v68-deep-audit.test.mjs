import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const read=p=>readFileSync(new URL(p,root),"utf8");
const html=read("index.html");
const nav=read("scripts/app.js");
const system=read("styles-system.css");
const base=read("styles.css");
const diagram=read("assets/roles-geometry-es.svg");
const mobileDiagram=read("assets/roles-geometry-mobile-es.svg");
const original=read("assets/roles-geometry-v2.svg");
const pack=JSON.parse(read("dist/site-manifest.json"));

test("V6.8 diagrams are Spanish in both pixels and accessibility descriptions",()=>{
 for(const label of ["CLIENTES","COMERCIOS","REPARTO","CONTROL","ENTREGA","PREPARA","SOLICITA","SUPERVISA"]){
  assert.ok(diagram.includes(">"+label+"</text>"),"Missing visible diagram term: "+label);
 }
 assert.doesNotMatch(diagram,/\bCUSTOMER\b|\bBUSINESS\b|\bRIDER\b/i);
 assert.match(diagram,/<desc id="d">Los clientes solicitan, los comercios preparan, los repartidores entregan y el control supervisa/);
 assert.doesNotMatch(html,/Diagrama conceptual de cuatro funciones/);
 for(const role of ["Para personas","Para comercios","Para repartidores","Para la operación"])assert.ok(html.includes(role));
 assert.doesNotMatch(html,/<source media="\(max-width:700px\)" srcset="\.\/assets\/roles-geometry-mobile-es\.svg"/);
 assert.match(mobileDiagram,/viewBox="0 0 360 392"/);
 for(const label of ["CLIENTES","COMERCIOS","REPARTO","CONTROL","ELEGIR","PREPARAR","ENTREGAR","SUPERVISAR"])
  assert.ok(mobileDiagram.includes(">"+label+"</text>"),"Mobile label not legible/translated: "+label);
 assert.doesNotMatch(mobileDiagram,/CUSTOMER|BUSINESS|RIDER/);
 assert.equal(read("dist/assets/roles-geometry-mobile-es.svg"),mobileDiagram);
 assert.equal(read("dist/assets/roles-geometry-es.svg"),diagram);
 assert.match(original,/>CUSTOMER<\/text>/);
 assert.doesNotMatch(html,/src="\.\/assets\/roles-geometry-es\.svg"/);
});

test("V6.8 navigation works progressively when scripts fail or are disabled",()=>{
 assert.match(base,/@media\(max-width:700px\)/);
 assert.match(base,/\.main-nav\{display:none;position:absolute/);
 assert.match(system,/html:not\(\.js-enabled\) \.main-nav\{\s*position:absolute;display:flex/);
 assert.match(system,/height:70px;min-height:70px;flex-wrap:nowrap/);
 assert.match(system,/html:not\(\.js-enabled\) \.menu-button\{display:none;\}/);
 assert.match(system,/html:not\(\.js-enabled\) \.site-header\{/);
 assert.match(nav,/document\.documentElement\.classList\.add\("js-enabled"\)/);
 assert.ok(nav.indexOf('classList.add("js-enabled")')>nav.indexOf('document.addEventListener("keydown"'));
 for(const id of ["inicio","vision","soluciones","ecosistema","negocios","contacto"])
  assert.ok(html.includes('id="'+id+'"'),"Lost section: "+id);
 assert.match(html,/class="main-nav"/);
 assert.match(html,/class="menu-button"/);
 assert.equal(read("dist/scripts/app.js"),nav);
 assert.equal(read("dist/styles-system.css"),system);
});

test("V6.8 signed inventory records every updated static asset",()=>{
 for(const path of ["assets/roles-geometry-es.svg","assets/roles-geometry-mobile-es.svg","styles-system.css","scripts/app.js"]){
  const found=pack.files.find(x=>x.path===path);
  assert.ok(found&&found.bytes>0,"Package omits "+path);
 }
 assert.ok(!pack.files.some(x=>x.path==="assets/roles-geometry-v2.svg"),"Do not ship the original English SVG");
 assert.equal(pack.noindex,true);
 assert.equal(pack.domain,"none");
 assert.match(html,/name="robots" content="noindex,nofollow"/);
});

test("V6.8 release readiness is NOT implied merely by owner-declared social links",()=>{
 assert.equal((html.match(/data-channel-review="owner-attested" data-channel-basis="owner-attested"/g)||[]).length,5);
 assert.doesNotMatch(html,/<form\b/i);
});
