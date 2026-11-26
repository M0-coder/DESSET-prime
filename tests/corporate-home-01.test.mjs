import test from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
for(const dir of ["","dist/"])test("Corporate hierarchy, honest content, working disclosure destinations "+(dir||"source"),()=>{
 const html=read(dir+"index.html"),nav=html.match(/<nav class="main-nav"[\s\S]*?<\/nav>/)[0];
 const ids=[...html.matchAll(/<section\b[^>]*\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(ids,["inicio","vision","empresa-destacada","noticias-destacadas","soluciones","ecosistema","talento-destacado","negocios"]);
 assert.equal((nav.match(/class="nav-expand"/g)||[]).length,2);
 for(const id of ["nav-empresa","nav-servicios"]){assert.ok(nav.includes('aria-controls="'+id+'"'));assert.ok(nav.includes('id="'+id+'" hidden'));}
 for(const path of ["./empresa.html#mision-vision","./empresa.html#historia","./noticias.html","./talento.html","./comercios.html","./repartidores.html","#ecosistema","#negocios"])assert.ok(nav.includes('href="'+path+'"'));
 assert.match(html,/No hay publicaciones oficiales anunciadas\./);assert.match(html,/Actualmente no se anuncian vacantes\./);
 assert.match(html,/name="robots" content="noindex,nofollow"/);assert.doesNotMatch(html,/<form\b|<input\b|<iframe\b/);
 assert.equal(read(dir+"scripts/app.js"),read("scripts/app.js"));
});