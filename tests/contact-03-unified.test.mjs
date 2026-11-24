import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
for(const dir of ["","dist/"]){
 test("CONTACT-03 single commercial closing, approved two-line title and no retired ornaments ("+(dir||"source")+")",()=>{
 const html=read(dir+"index.html"),css=read(dir+"styles.css");
 const section=html.match(/<section class="audiences" id="negocios"[^>]*>([\s\S]*?)<\/section>/)?.[1];
 assert.ok(section);assert.equal((html.match(/id="contacto"/g)||[]).length,1);
 assert.ok(section.indexOf('id="contact-title"')<section.indexOf('class="audience-grid audience-grid--compact"'));
 assert.match(section,/<span class="closing-line">LAS BUENAS CONEXIONES<\/span>\s*<span class="closing-line closing-line--final"><em>COMIENZAN AQUÍ<\/em>/);
 assert.equal((section.match(/<article\b/g)||[]).length,2);
 assert.doesNotMatch(section,/v5-contact-light|closing-line--middle|contact-bottom/);
 assert.match(css,/#negocios #contacto\.contact::before,#negocios #contacto\.contact::after\{content:none;animation:none\}/);
 assert.match(css,/#negocios #contacto\.contact \.closing-line::after\{content:none;animation:none\}/);
 });
}
