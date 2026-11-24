import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const root=new URL("../",import.meta.url),read=p=>readFileSync(new URL(p,root),"utf8");
const pages=["index.html","empresa.html"];
for(const dir of ["","dist/"]){
 test("Corporate links resolve in "+(dir||"source"),()=>{
  const docs=Object.fromEntries(pages.map(p=>[p,read(dir+p)]));
  for(const [name,doc] of Object.entries(docs)){
   assert.match(doc,/name="robots" content="noindex,nofollow"/);
   for(const m of doc.matchAll(/<a\b[^>]*href="([^"]+)"/g)){
    const href=m[1];
    if(href.startsWith("https://")){assert.equal(name,"index.html");continue}
    const match=href.match(/^(?:\.\/(index|empresa)\.html)?(?:#([a-z0-9-]+))?$/);
    assert.ok(match,"Unapproved route "+href);
    const target=docs[match[1]?match[1]+".html":name];
    assert.ok(target);
    if(match[2])assert.ok(target.includes('id="'+match[2]+'"'),"Missing anchor "+href);
   }
  }
  const company=docs["empresa.html"];
  assert.match(company,/<h1>Empresa<\/h1>/);
  assert.doesNotMatch(company,/<form\b|<script\b|<iframe\b|https?:\/\//i);
  assert.equal((company.match(/<section id="/g)||[]).length,6);
  assert.match(docs["index.html"],/href="\.\/empresa\.html">Empresa<\/a>/);
  const css=Buffer.from(read(dir+"styles.css"));
  const rev=createHash("sha1").update("blob "+css.length+"\0").update(css).digest("hex");
  for(const doc of Object.values(docs))assert.ok(doc.includes('href="./styles.css?v='+rev+'"'));
 });
}
