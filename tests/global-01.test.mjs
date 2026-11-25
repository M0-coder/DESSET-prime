import test from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";import {createHash} from "node:crypto";
const read=p=>readFileSync(new URL("../"+p,import.meta.url));
const reviewed={
 "empresa.html":"e3ef282e693db91fe2e7a26bd5b5caca1c061484",
 "prime.html":"ccad9d7e9eb102bdeacb92493d725b45eab0d55b",
 "contacto.html":"e1f62f02ccc742c03c182bf594fe14938ac1307a",
 "confianza.html":"d3bb7d81b0b925782be48411e78b138fb91e5f98",
 "noticias.html":"3425eac2b58e64bd3fb00d9726cd215be17f5c37",
 "talento.html":"9d3badbb924d8d58d2cfcb070289f23d6fff8def"
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
