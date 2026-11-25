import test from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
for(const dir of ["","dist/"])test("Merchant pre-registration is an explicitly inactive model "+(dir||"source"),()=>{
 const merchant=read(dir+"comercios.html"),reg=read(dir+"registro-comercios.html"),guide=read(dir+"incorporacion-comercios.html");
 for(const page of [reg,guide]){
 assert.match(page,/name="robots" content="noindex,nofollow"/);
 assert.match(page,/form-action 'none'/);
 assert.doesNotMatch(page,/<(?:form|script|iframe)\b|https?:\/\/|mailto:|tel:/i);
 }
 assert.match(merchant,/href="\.\/registro-comercios.html"/);
 assert.match(merchant,/href="\.\/incorporacion-comercios.html"/);
 assert.match(reg,/recepción de solicitudes aún no está habilitada/);
 for(const field of reg.matchAll(/<(?:input|select|textarea|button)\b[^>]*>/g))assert.match(field[0],/\bdisabled\b/);
 assert.equal((reg.match(/<fieldset disabled/g)||[]).length,2);
 assert.match(reg,/No se ha recibido ninguna solicitud/);
 assert.equal((guide.match(/<li><h2>/g)||[]).length,5);
 assert.match(guide,/No se reciben solicitudes actualmente/);
 assert.doesNotMatch(read(dir+"repartidores.html"),/registro-comercios|incorporacion-comercios|styles-onboarding/);
 assert.ok(Buffer.byteLength(read(dir+"styles-onboarding.css"))<=4000);
});
