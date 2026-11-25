import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,cpSync,readFileSync,writeFileSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
const root=fileURLToPath(new URL("../",import.meta.url));
const pages=["index.html","empresa.html","comercios.html","repartidores.html","prime.html","contacto.html","confianza.html","noticias.html","talento.html","en.html","registro-comercios.html","incorporacion-comercios.html","registro-repartidores.html","incorporacion-repartidores.html","capacitacion-repartidores.html"];
test("Static gate scans every institutional page and rejects representative violations",()=>{
 const dir=mkdtempSync(join(tmpdir(),"desset-static-all-"));
 try{
 const names=[...pages,"_headers","styles.css","styles-typography.css","styles-v5.css","styles-system.css","styles-hero-photo.css","styles-visual02.css","styles-audiences.css","styles-prime.css","styles-contact.css","styles-trust.css","styles-news.css","styles-careers.css","styles-onboarding.css","assets","fonts","scripts"," .github".trim()];
 for(const name of names)cpSync(join(root,name),join(dir,name),{recursive:true});
 const run=()=>spawnSync(process.execPath,[join(dir,"scripts/static-gate.mjs")],{encoding:"utf8"});
 const ok=run();assert.equal(ok.status,0,ok.stderr);
 assert.deepEqual(JSON.parse(readFileSync(join(dir,"reports/quality/static.json"),"utf8")).pages_checked,pages);
 const cases=[
 ["en.html",s=>s.replace("noindex,nofollow","index,follow"),"Missing noindex"],
 ["talento.html",s=>s.replace("</head>",'<script src="https://untrusted.example/a.js"></script></head>'),"Nonlocal DOM resource"],
 ["noticias.html",s=>s.replace("noindex,nofollow","index,follow"),"Missing noindex"],
 ["confianza.html",s=>s.replace("form-action 'none'","form-action *"),"Missing or weakened local CSP"],
 ["contacto.html",s=>s.replace("</main>",'<form></form></main>'),"Unauthorized form/iframe/video"],
 ["prime.html",s=>s.replace("</main>",'<a href="#absent-anchor">Broken</a></main>'),"Broken in-page navigation anchor"]
 ];
 for(const [page,mutate,expected] of cases){
 const path=join(dir,page),original=readFileSync(path,"utf8"),changed=mutate(original);
 assert.notEqual(changed,original);writeFileSync(path,changed);
 const r=run();assert.equal(r.status,1,r.stderr);assert.ok(r.stderr.includes(page+": "+expected),r.stderr);
 writeFileSync(path,original);
 }
 }finally{rmSync(dir,{recursive:true,force:true});}
});
