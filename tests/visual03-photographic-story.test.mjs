import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import {createHash} from "node:crypto";
const root=new URL("../",import.meta.url),read=p=>readFileSync(new URL(p,root),"utf8");
const html=read("index.html"),css=read("styles.css"),browser=read("scripts/browser-audit.mjs");
const photos=[{"name":"ecosistema-proveedores","sha256":"bc4c3e9301659949b65373eeeffccb1fddd9b5c67bdbeb8598a511a79dc98170","label":"PROVEEDORES"},{"name":"ecosistema-comercios","sha256":"3370bbb94434edf705b2144bd86f1b60aba1b39f1989d58a5a187dca1b6ff2c2","label":"COMERCIOS"},{"name":"ecosistema-consumidores","sha256":"9f7eb3e2d747b1dbb7fb7a98d4b24fa3d508e544abe95a5a39d0bd33a93f99a7","label":"PERSONAS"},{"name":"ecosistema-operadores-logisticos","sha256":"c52d48b9d9614fd169bdd8301088b85d55a177532b85b004656a873cd14e9230","label":"OPERADORES LOGÍSTICOS"}];
test("ECOSYSTEM-PARTICIPANTS-01 four exact photographs, no hero duplication",()=>{
 const vision=html.split('<section class="statement" id="vision"')[1].split("</section>")[0];
 assert.equal((vision.match(/<picture class="v03-photo-story">/g)||[]).length,4);
 for(const {name,label} of photos){
  assert.ok(vision.includes('src="./assets/'+name+'.webp"'));
  assert.ok(vision.includes("<h3>"+label+"</h3>"));
 }
 assert.equal((vision.match(/loading="lazy"/g)||[]).length,4);
 assert.equal((vision.match(/alt="[^"]+"/g)||[]).length,4);
 assert.doesNotMatch(vision,/desset-hero-entrega|scene-(?:choose|prepare|move)\./);
 assert.match(html,/Escena conceptual: personas, paquetes y arquitectura urbana/);
 assert.match(html,/Conoce nuestro propósito/);
 assert.match(html,/deliver-assets-mark\.png/);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
});
test("Binary WebPs retain the exact approved hashes and total budget",()=>{
 const hashes=new Set();let total=0;
 for(const {name,sha256} of photos){
  const payload=readFileSync(new URL("assets/"+name+".webp",root));total+=payload.length;
  assert.ok(payload.length<=225000,"Per-photo budget exceeded: "+name);
  assert.equal(payload.toString("ascii",0,4),"RIFF");
  assert.equal(payload.toString("ascii",8,12),"WEBP");
  assert.equal(createHash("sha256").update(payload).digest("hex"),sha256);
  hashes.add(sha256);
 }
 assert.equal(hashes.size,4);assert.ok(total<=600000);
});
test("Clean accessible photo cards: static, no remote assets, no hero crop",()=>{
 const scoped=css.slice(css.indexOf("/* ECOSYSTEM-PARTICIPANTS-01"));
 assert.match(scoped,/object-fit:cover/);
 assert.match(scoped,/animation:none/);
 assert.doesNotMatch(scoped,/background-image|https?:\/\/|@import|@font-face/);
 assert.ok(statSync(new URL("styles-visual02.css",root)).size<=8200);
 assert.match(browser,/ECOSYSTEM-PARTICIPANTS-01 four different approved photos, exact sizes, alternative text/);
});
test("Packaged assets also retain approved checksums; no public domain",()=>{
 const manifest=JSON.parse(read("dist/site-manifest.json"));
 assert.equal(manifest.domain,"none");assert.equal(manifest.noindex,true);
 for(const {name,sha256} of photos){
  const original=readFileSync(new URL("assets/"+name+".webp",root)),packaged=readFileSync(new URL("dist/assets/"+name+".webp",root));
  assert.deepEqual(packaged,original);
  assert.equal(createHash("sha256").update(packaged).digest("hex"),sha256);
  assert.ok(manifest.files.some(f=>f.path==="assets/"+name+".webp"));
 }
});
