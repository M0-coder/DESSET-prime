import test from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";import {createHash} from "node:crypto";
const read=p=>readFileSync(new URL("../"+p,import.meta.url));
const reviewed={
 "empresa.html":"91ee19352e192f541db0e94a2882613ec14848e7",
 "prime.html":"7383623e07c791334a4d5fd6c313b74c139c410b",
 "contacto.html":"3714be7c7b2797b2f7552cc23a0fd65532686be3",
 "confianza.html":"d2c92ae0b149f66f865a2b32e3803c9730a9f658",
 "noticias.html":"496e0629469803043e5e8923de226fb0110b99d1",
 "talento.html":"8e35fcb5bdfd375ca59807fc63d116b1674b41b6"
};
for(const dir of ["","dist/"]){test("GLOBAL-01 English overview and source editorial review lock "+(dir||"source"),()=>{
 const html=read(dir+"en.html").toString();
 assert.match(html,/<html lang="en">/);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
 assert.match(html,/form-action 'none'/);
 assert.match(html,/does not process orders or payments/);
 assert.match(html,/does not imply active international operations/);
 assert.match(html,/Detailed institutional pages are currently available in Spanish/);
 assert.match(html,/href="\.\/aplicaciones\.html" hreflang="es">Applications \(Spanish\)/);
 assert.match(html,/href="\.\/empresa\.html" lang="es" hreflang="es">Español/);
 assert.doesNotMatch(html,/<(?:script|form|input|iframe|textarea)\b|https?:\/\/|footer-social|data-footer-channel/i);
 for(const page of ["index.html","empresa.html"])assert.match(read(dir+page).toString(),/href="\.\/en\.html" lang="en" hreflang="en">English/);
 for(const [page,sha] of Object.entries(reviewed)){
 const bytes=read(dir+page),actual=createHash("sha1").update("blob "+bytes.length+"\0").update(bytes).digest("hex");
 assert.equal(actual,sha,"Spanish source changed: review English overview and update editorial lock for "+page);
 }
});}
