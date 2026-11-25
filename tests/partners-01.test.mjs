import test from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
for(const dir of ["","dist/"]){test("PARTNERS-01 cooperation scope within existing contact directory "+(dir||"source"),()=>{
 const html=read(dir+"contacto.html"),block=html.match(/<details class="ct-item" id="alianzas"[\s\S]*?<\/details>/)?.[0];
 assert.ok(block);
 for(const scope of ["tecnología e integraciones","transporte y distribución","abastecimiento","proyectos empresariales conjuntos","viabilidad","responsabilidades","aún no está habilitado"])assert.ok(block.includes(scope),scope);
 assert.doesNotMatch(block,/<(?:form|input|a|img|script|iframe)\b|mailto:|tel:|socios confirmados|alianzas vigentes/i);
 assert.equal((html.match(/id="alianzas"/g)||[]).length,1);
 assert.doesNotMatch(read(dir+"empresa.html"),/id="alianzas"/);
 assert.doesNotMatch(read(dir+"index.html"),/id="alianzas"/);
});}
