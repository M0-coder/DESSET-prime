import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const read=p=>readFileSync(new URL(p,root),"utf8");
const html=read("index.html");
const nav=read("scripts/app.js");
const system=read("styles-system.css");
const base=read("styles.css");
const diagram=read("assets/roles-geometry-v2.svg");
const pack=JSON.parse(read("dist/site-manifest.json"));

test("V6.8 diagrams are Spanish in both pixels and accessibility descriptions",()=>{
 for(const label of ["CLIENTES","COMERCIOS","REPARTO","CONTROL","ENTREGA","PREPARA","SOLICITA","SUPERVISA"]){
  assert.ok(diagram.includes(">"+label+"</text>"),"Missing visible diagram term: "+label);
 }
 assert.doesNotMatch(diagram,/\bCUSTOMER\b|\bBUSINESS\b|\bRIDER\b/i);
 assert.match(diagram,/<desc id="d">Los clientes solicitan, los comercios preparan, los repartidores entregan y el control supervisa/);
 assert.match(html,/funciones del sistema: clientes, comercios, repartidores y control/);
 assert.equal(read("dist/assets/roles-geometry-v2.svg"),diagram);
});

test("V6.8 navigation works progressively when scripts fail or are disabled",()=>{
 assert.match(base,/@media\(max-width:700px\)/);
 assert.match(base,/\.main-nav\{display:none;position:absolute/);
 assert.match(system,/html:not\(\.js-enabled\) \.main-nav\{\s*position:static;display:flex/);
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
 for(const path of ["assets/roles-geometry-v2.svg","styles-system.css","scripts/app.js"]){
  const found=pack.files.find(x=>x.path===path);
  assert.ok(found&&found.bytes>0,"Package omits "+path);
 }
 assert.equal(pack.noindex,true);
 assert.equal(pack.domain,"none");
 assert.match(html,/name="robots" content="noindex,nofollow"/);
});

test("V6.8 release readiness is NOT implied by an unverified social link",()=>{
 assert.equal((html.match(/data-channel-review="pending"/g)||[]).length,3);
 assert.doesNotMatch(html,/<form\b/i);
});
