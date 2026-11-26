import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const audit=read("scripts/browser-audit.mjs");
for(const dir of ["","dist/"])test("Retired technical accordion is physically absent, not hidden: "+(dir||"source"),()=>{
 const html=read(dir+"index.html");
 assert.doesNotMatch(html,/v4-architecture-details|ecosystem-board v4-flow-board|Explorar las funciones de clientes/);
 assert.match(html,/href="\.\/prime\.html#modelo"/);
 assert.doesNotMatch(html,/<details class="future-services"/);
});
test("Responsive and keyboard QA validates the remaining Prime link",()=>{
 assert.match(audit,/390px full-page capture: technical disclosure ABSENT, services visible/);
 assert.match(audit,/320px full-page capture: technical disclosure ABSENT, services visible/);
 assert.match(audit,/Freshly navigated page: technical disclosure ABSENT; obsolete services absent/);
 assert.match(audit,/V5\.4 keyboard Prime model link/);
 assert.doesNotMatch(audit,/mobile-architecture-expanded\.png/);
});
