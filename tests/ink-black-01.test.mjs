import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const legacy=/#(?:111111|111)(?![0-9a-f])/i;
const institutional=["styles.css","styles-system.css","styles-typography.css","styles-hero-photo.css","styles-applications.css","styles-audiences.css","styles-careers.css","styles-contact.css","styles-news.css","styles-onboarding.css","styles-prime.css","styles-trust.css","styles-visual02.css"];
for(const dir of ["","dist/"])test("INK-BLACK-01 institutional black and frozen visual exceptions "+(dir||"source"),()=>{
 for(const path of institutional){
  let css=read(dir+path);
  if(path==="styles.css"){
   assert.match(css,/--ink:#000000;/);
   const frozen=["#ecosistema{--ink:#111111;--ds-30-ink:#111111;color:#111111}",".v4-flow-board{background:#111;","width:84px;min-height:81px;background:#111111;"];
   for(const rule of frozen){assert.ok(css.includes(rule),"Missing frozen visual ink: "+rule);css=css.replace(rule,"");}
  }
  if(path==="styles-system.css")assert.match(css,/--ds-30-ink:#000000;/);
  if(path==="styles-typography.css"){
   for(const rule of ["#ecosistema .v4-architecture-details summary{color:#111111}",".v4-flow-board{background:#fff;color:#111111;"]){assert.ok(css.includes(rule));css=css.replace(rule,"");}
  }
  assert.doesNotMatch(css,legacy,"Unexpected institutional near-black in "+path);
 }
 assert.match(read(dir+"styles-v5.css"),/#ecosistema \.prime-3d-heading p\{[^\n]*color:#111111/);
});
