import test from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";import {createHash} from "node:crypto";
const read=p=>readFileSync(new URL("../"+p,import.meta.url));
const reviewed={
 "empresa.html":"3c10f50685aca404453b6cb35815d7fb1e95112f",
 "prime.html":"1b5cd70582402a03eeda44fb9e5c07100e97b6e0",
 "contacto.html":"a60fcbfac1412a9813c3dcea1dd45db2a4fc9b51",
 "confianza.html":"9c3947d3df2da1c66505fc5841d43d99b8ca0a8f",
 "noticias.html":"df5e11721bcfec864c7591a48218a6ebe4ad29d4",
 "talento.html":"ab092b24171da815fc87185329591b6ffb1e0939" // CAREERS-02 reviewed against unchanged English overview; recruitment remains inactive.
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
