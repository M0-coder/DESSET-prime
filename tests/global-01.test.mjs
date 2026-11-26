import test from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";import {createHash} from "node:crypto";
const read=p=>readFileSync(new URL("../"+p,import.meta.url));
const reviewed={
 "empresa.html":"b3da680880b9025fca8940ef93bfa3da60a7750d",
 "prime.html":"ccad9d7e9eb102bdeacb92493d725b45eab0d55b",
 "contacto.html":"0330ca0e6616fc29cdcc030b65fc51e7454eccff",
 "confianza.html":"31dd81f770a5d59bf67be2ca00c01f79d69a2262",
 "noticias.html":"c50f77103c4b963114169fed62b2a869c9a03258",
 "talento.html":"2f63333d004cb16199c7918e2c0647eb62bcf3b0"
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
