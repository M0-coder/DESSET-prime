import test from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
for(const dir of ["","dist/"])test("Corporate hierarchy, honest content, working disclosure destinations "+(dir||"source"),()=>{
 const html=read(dir+"index.html"),nav=html.match(/<nav class="main-nav"[\s\S]*?<\/nav>/)[0];
 const ids=[...html.matchAll(/<section\b[^>]*\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(ids,["inicio","empresa-destacada","noticias-destacadas","soluciones","vision","talento-destacado","negocios"]);
 assert.equal((nav.match(/class="nav-expand"/g)||[]).length,2);
 for(const id of ["nav-empresa","nav-servicios"]){assert.ok(nav.includes('aria-controls="'+id+'"'));assert.ok(nav.includes('id="'+id+'" hidden'));}
 for(const path of ["./empresa.html#mision-vision","./empresa.html#historia","./noticias.html","./talento.html","./comercios.html","./repartidores.html","#ecosistema","#negocios"])assert.ok(nav.includes('href="'+path+'"'));
 assert.match(html,/No hay publicaciones oficiales anunciadas\./);assert.match(html,/Actualmente no se anuncian vacantes\./);
 assert.match(html,/name="robots" content="noindex,nofollow"/);assert.doesNotMatch(html,/<form\b|<input\b|<iframe\b/);
 assert.equal(read(dir+"scripts/app.js"),read("scripts/app.js"));
});
test("New editorial CSS remains isolated and bounded without changing the original styling or Lighthouse thresholds",()=>{const css=read("styles-system.css");const extra=css.split("/* CORPORATE-HOME-01:")[1].split("/* WEB-CLOSE-04:")[0];assert.ok(Buffer.byteLength(extra,"utf8")<4000);assert.match(extra,/content-visibility:auto/);assert.doesNotMatch(extra,/#inicio|\.v6-|\.v5-city|\.hero-cta|\.service--/);assert.ok(Buffer.byteLength(css,"utf8")<=14000);const lh=read("scripts/lighthouse-summary.mjs");assert.match(lh,/categories\.performance<85/);});

for(const dir of ["","dist/"])test("Corporate principles, governance and news category destinations "+(dir||"source"),()=>{const home=read(dir+"index.html"),company=read(dir+"empresa.html"),news=read(dir+"noticias.html");for(const id of ["principios-actuacion","gobierno-responsabilidad"]){assert.ok(home.includes('href="./empresa.html#'+id+'"'));assert.ok(company.includes('id="'+id+'"'));}assert.match(read(dir+"gobierno-corporativo.html"),/La estructura jurídica y las responsabilidades formales se comunicarán cuando exista documentación acreditada/);assert.match(read(dir+"gobierno-corporativo.html"),/no constituye una certificación ni una oferta de inversión/);for(const id of ["nw-press","nw-announcements","nw-media","recursos-de-marca"]){assert.ok(home.includes('href="./noticias.html#'+id+'"'));assert.ok(news.includes('id="'+id+'"'));}});
