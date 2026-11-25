import test from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";import {createHash} from "node:crypto";
const read=p=>readFileSync(new URL("../"+p,import.meta.url));
for(const dir of ["","dist/"]){test("BRAND-01 original symbol bytes, reference palette and limited rights "+(dir||"source"),()=>{
 const png=read(dir+"assets/deliver-assets-mark.png"),html=read(dir+"noticias.html").toString();
 assert.equal(createHash("sha256").update(png).digest("hex"),"740e142d3e6026f67bec4aca3021e1bfa2a988eb0150af4633a57813ad81b7f4");
 assert.equal(png.readUInt32BE(16),96);assert.equal(png.readUInt32BE(20),73);
 assert.deepEqual([...html.matchAll(/href="([^"]+)" download="([^"]+)"/g)].map(m=>m.slice(1)),[["./assets/deliver-assets-mark.png","DESSET-simbolo.png"]]);
 for(const color of ["#1551D8","#111111","#F4F8FE","#FFFFFF"])assert.ok(html.includes(color));
 for(const font of ["Plus Jakarta Sans","Inter"])assert.ok(html.includes(font));
 assert.match(html,/no constituye una licencia de uso/);assert.match(html,/versiones vectoriales, de alta resolución/);
 assert.doesNotMatch(html,/uso libre|licencia ilimitada|marca registrada/i);
});}
