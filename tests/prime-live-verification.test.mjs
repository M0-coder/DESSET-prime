import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {verifyLive} from '../scripts/prime-live-verification.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
function fixture(t){
 const root=mkdtempSync(join(tmpdir(),'prime-live-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const dir=join(root,'public');mkdirSync(dir);
 const html=canonical=>'<link rel="canonical" href="'+canonical+'"><meta name="robots" content="noindex,nofollow"><link href="./styles.css?v='+'a'.repeat(40)+'">';
 const map={'index.html':html('https://desset.lat/'),'empresa.html':html('https://desset.lat/empresa'),'comercios.html':html('https://desset.lat/comercios'),'repartidores.html':html('https://desset.lat/repartidores'),'prime.html':html('https://desset.lat/prime'),'contacto.html':html('https://desset.lat/contacto'),'404.html':'not found','_headers':'policy','robots.txt':'Disallow: /','sitemap.xml':'empty','styles.css':'body{}','styles-audiences.css':'.audience-page{}','styles-prime.css':'.prime-page{}','styles-contact.css':'.contact-page{}'};
 for(let i=0;i<33;i++)map['assets/test-'+i+'.webp']='asset '+i;
 const assets=Object.entries(map).map(([path,value])=>{const b=Buffer.from(value);mkdirSync(dirname(join(dir,path)),{recursive:true});writeFileSync(join(dir,path),b);return {path,bytes:b.length,sha256:hash(b)}});
 const reportPath=join(root,'report.json');writeFileSync(reportPath,JSON.stringify({schema:'desset-prime-manual-release-package-v1',seo_policy:'NOINDEX',production_authorized:false,production_deployed:false,package_files:47,assets,assets_manifest_sha256:hash(Buffer.from(JSON.stringify(assets)))}));
 const requests=[],logs=[];
 const mock=(url,opts)=>{requests.push([url,opts.method]);const p=new URL(url).pathname;const k=p==='/'?'index.html':p==='/empresa'?'empresa.html':p==='/comercios'?'comercios.html':p==='/repartidores'?'repartidores.html':p==='/prime'?'prime.html':p==='/contacto'?'contacto.html':p==='/__desset_prime_missing_path__'?'404.html':p.slice(1);return new Response(map[k]??'missing',{status:k==='404.html'?404:200,headers:{'content-type':'text/html','content-security-policy':"default-src 'self'",'x-content-type-options':'nosniff'}})};
 return {opts:{publicDir:dir,reportPath,request:mock,attempts:2,delay:0,log:l=>logs.push(l)},requests,logs,mock};
}
test('exact public bytes, both hosts, both company paths, revision and 404',async t=>{
 const f=fixture(t);assert.equal((await verifyLive(f.opts)).result,'PASS');
 assert.ok(f.requests.every(x=>x[1]==='GET'));assert.ok(f.requests.some(x=>x[0].includes('/empresa.html')));assert.ok(f.requests.some(x=>x[0].includes('/comercios.html')));assert.ok(f.requests.some(x=>x[0].includes('/repartidores.html')));assert.ok(f.requests.some(x=>x[0].includes('/prime.html')));assert.ok(f.requests.some(x=>x[0].endsWith('/prime')));assert.ok(f.requests.some(x=>x[0].endsWith('/contacto')));assert.ok(f.requests.some(x=>x[0].endsWith('/contacto.html')));assert.ok(f.requests.some(x=>x[0].includes('styles.css?v=')));
});
test('stale bytes with HTTP 200 are retried, never silently accepted',async t=>{
 const f=fixture(t);let tries=0;
 f.opts.request=(url,opts)=>{if(url==='https://desset.lat/styles.css'&&tries++===0)return new Response('old');return f.mock(url,opts)};
 assert.equal((await verifyLive(f.opts)).result,'PASS');assert.equal(tries,2);assert.ok(f.logs.some(x=>x.includes('bytes/SHA256 differ')));
});
test('persistent mismatch names URL and refuses PASS',async t=>{
 const f=fixture(t);f.opts.request=(url,opts)=>url==='https://www.desset.lat/empresa'?new Response('stale'):f.mock(url,opts);
 await assert.rejects(verifyLive(f.opts),/PUBLIC LIVE FAIL.*www\.desset\.lat\/empresa/);
});
test('external redirects are rejected without following',async t=>{
 const f=fixture(t);f.opts.request=(url,opts)=>url==='https://desset.lat/empresa'?new Response(null,{status:302,headers:{location:'https://example.org/'}}):f.mock(url,opts);
 await assert.rejects(verifyLive(f.opts),/unexpected redirect origin/);assert.ok(!f.requests.some(x=>x[0].includes('example.org')));
});
