import test from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";import {createHash} from "node:crypto";
const read=p=>readFileSync(new URL("../"+p,import.meta.url));
const reviewed={
 "empresa.html":"ebe2aa90ebb64cc5fc9bac20ec4b7827c6dbce61",
 "prime.html":"ccad9d7e9eb102bdeacb92493d725b45eab0d55b",
 "contacto.html":"57f892c008f4ea985ac331d96f67adf265b09974",
 "confianza.html":"969b86f7e8f6027cdd5f1fc3c55e15790f840fbd",
 "noticias.html":"ecce3105c9ef8726267880f41a8fadf8f1c0817a",
 "talento.html":"489c941141b9b4bc21831efcbd2a13b446096f76"
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
 for(const page of ["index.html","empresa.html","prime.html"])assert.match(read(dir+page).toString(),/href="\.\/en\.html" lang="en" hreflang="en">English/);
 for(const [page,sha] of Object.entries(reviewed)){
 const bytes=read(dir+page),actual=createHash("sha1").update("blob "+bytes.length+"\0").update(bytes).digest("hex");
 assert.equal(actual,sha,"Spanish source changed: review English overview and update editorial lock for "+page);
 }
});}
