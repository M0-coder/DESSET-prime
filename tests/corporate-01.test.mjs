import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const root=new URL("../",import.meta.url),read=p=>readFileSync(new URL(p,root),"utf8");
const pages=["index.html","empresa.html"];
const approved=new Map(JSON.parse(read("config/prime-social-owner-attestation.json")).exact_channels.map(c=>[c.url,c.platform]));
for(const dir of ["","dist/"]){
 test("Corporate links resolve in "+(dir||"source"),()=>{
  const docs=Object.fromEntries(pages.map(p=>[p,read(dir+p)]));
  for(const [name,doc] of Object.entries(docs)){
   assert.match(doc,/name="robots" content="noindex,nofollow"/);
   for(const m of doc.matchAll(/<a\b[^>]*href="([^"]+)"/g)){
    const href=m[1];
    if(href.startsWith("https://")){assert.ok(approved.has(href));continue}
    const match=href.match(/^(?:\.\/(index|empresa)\.html)?(?:#([a-z0-9-]+))?$/);
    assert.ok(match,"Unapproved route "+href);
    const target=docs[match[1]?match[1]+".html":name];
    assert.ok(target);
    if(match[2])assert.ok(target.includes('id="'+match[2]+'"'),"Missing anchor "+href);
   }
  }
  for(const doc of Object.values(docs)){
   const footer=doc.match(/<nav class="footer-social"[^>]*>([\s\S]*?)<\/nav>/)?.[1];assert.ok(footer);
   const links=[...footer.matchAll(/href="([^"]+)" data-footer-channel="([^"]+)" aria-label="([^"]+)" target="_blank" rel="noopener noreferrer"/g)];
   assert.equal(links.length,5);assert.equal(new Set(links.map(m=>m[1])).size,5);
   for(const [,url,name,label] of links){assert.equal(approved.get(url),name);assert.equal(name,label);}
   assert.match(doc,/<p>© 2026 DESSET\. Todos los derechos reservados\.<\/p>/);
  }
  assert.doesNotMatch(docs["index.html"],/contact-bottom|contact-primary|social-links--official|Conoce los perfiles de DESSET/);
  const company=docs["empresa.html"];
  assert.match(company,/Esta web no procesa transacciones\./);
  assert.match(company,/<h1>Empresa<\/h1>/);
  assert.doesNotMatch(company,/<form\b|<script\b|<iframe\b/i);
  assert.equal((company.match(/<section id="/g)||[]).length,6);
  assert.match(docs["index.html"],/href="\.\/empresa\.html">Empresa<\/a>/);
  const css=Buffer.from(read(dir+"styles.css"));
  const rev=createHash("sha1").update("blob "+css.length+"\0").update(css).digest("hex");
  for(const doc of Object.values(docs))assert.ok(doc.includes('href="./styles.css?v='+rev+'"'));
 });
}
