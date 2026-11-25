import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
for(const dir of ["","dist/"]){
 test("HISTORY-01 verified digital milestones and no invented corporate founding "+(dir||"source"),()=>{
 const html=read(dir+"empresa.html"),history=html.match(/<section id="historia"[\s\S]*?<\/section>/)?.[0];
 assert.ok(history);
 assert.match(history,/<h3 class="history-year">2026<\/h3>/);
 assert.deepEqual([...history.matchAll(/<h4>([^<]+)<\/h4>/g)].map(m=>m[1]),["Identidad institucional","DESSET prime","Infraestructura corporativa"]);
 assert.doesNotMatch(history,/fundad[oa]|constituci[oó]n|inicio de operaciones|clientes atendidos|pedidos realizados|expansi[oó]n comercial/i);
 assert.match(read(dir+"styles-system.css"),/\.company-page \.history-timeline\{/);
 assert.doesNotMatch(read(dir+"index.html"),/class="history-timeline"/);
 });
}
