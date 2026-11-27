import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,readdirSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const plan=JSON.parse(read("config/brand-dual-palette-plan.json"));
const migrated=["styles-company.css","styles-contact.css","styles-news.css","styles-trust.css","styles-applications.css","styles-onboarding.css","styles-careers.css","styles-audiences.css","styles-prime.css"];
test("BRAND-DUAL-PALETTE-01 two brand palettes and complete route inventory",()=>{
 assert.deepEqual(Object.values(plan.palettes.corporate).slice(0,6),["#1748BF","#E8342A","#FFC011","#F7F2E1","#111111","#FFFFFF"]);
 assert.deepEqual(Object.values(plan.palettes.digital).slice(0,6),["#073BBC","#FF3328","#FFC62F","#F7F5EE","#000000","#FFFFFF"]);
 assert.equal(plan.release_authorized,false);
 const pages=plan.page_groups.flatMap(g=>g.pages).sort();
 assert.equal(pages.length,26);assert.equal(new Set(pages).size,26);
 for(const prefix of ["","dist/"]){
  const actual=readdirSync(new URL("../"+prefix,import.meta.url)).filter(x=>x.endsWith(".html")).sort();
  assert.deepEqual(actual,pages);
  for(const page of pages){const h=read(prefix+page);assert.match(h,/href="\.\/styles\.css\?v=[a-f0-9]+"/);assert.match(h,/name="robots" content="noindex,nofollow"/);}
 }
});
test("BRAND-DUAL-PALETTE-01 canonical digital blue and unshadowed CSS references in source and dist",()=>{
 for(const prefix of ["","dist/"]){
  const root=read(prefix+"styles.css");assert.match(root,/:root\{--blue:#073BBC;/);
  assert.match(root,/--yellow:#FFC62F;--red:#FF3328;/);
  assert.match(root,/--ink:#000000;--paper:#F7F5EE;/);
  for(const f of readdirSync(new URL("../"+prefix,import.meta.url)).filter(x=>x.endsWith(".css"))){
   const definitions=read(prefix+f).match(/(?:^|[;{])\s*--blue\s*:/gm)||[];
   assert.equal(definitions.length,f==="styles.css"?1:0,"Shadowed canonical blue in "+f);
  }
  for(const f of migrated){const css=read(prefix+f);assert.match(css,/var\(--blue\)/);assert.doesNotMatch(css,/#073bbc\b/i,"Duplicated blue in "+f);assert.equal(css,read(f),"Packaged stylesheet differs from source: "+f);}
 }
});
