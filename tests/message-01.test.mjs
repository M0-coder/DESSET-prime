import test from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
for(const dir of ["","dist/"]){test("MESSAGE-01 institutional direction without fictitious officeholders or operational claims "+(dir||"source"),()=>{
 const html=read(dir+"empresa.html"),block=html.match(/<section id="mensaje-direccion"[\s\S]*?<\/section>/)?.[0];
 assert.ok(block);assert.match(block,/<h2 id="mensaje-direccion-title">Mensaje de la dirección<\/h2>/);
 assert.equal((block.match(/<p>/g)||[]).length,4);
 assert.match(block,/preparación de cada capacidad antes de ponerla a disposición del público/);
 assert.doesNotMatch(block,/<img\b|<a\b|<form\b|CEO|gerente general|presidente ejecutivo|fundador:|clientes atendidos|pedidos realizados|resultados obtenidos/i);
 assert.doesNotMatch(read(dir+"index.html"),/id="mensaje-direccion"/);
});}
