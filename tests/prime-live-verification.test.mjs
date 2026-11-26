import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {preparePrimeCutoverPackage} from '../scripts/prime-manual-cutover-package.mjs';
const primePhotos=["assets/prime-hero-logistica.webp","assets/prime-paqueteria.webp","assets/prime-distribucion.webp","assets/prime-fulfillment.webp","assets/prime-tecnologia-logistica.webp","assets/prime-vision-internacional.webp"];
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import {verifyLive} from '../scripts/prime-live-verification.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
function fixture(t){
 const root=mkdtempSync(join(tmpdir(),'prime-live-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const dir=join(root,'public');mkdirSync(dir);
 const html=canonical=>'<link rel="canonical" href="'+canonical+'"><meta name="robots" content="noindex,nofollow"><link href="./styles.css?v='+'a'.repeat(40)+'">';
 const map={'index.html':html('https://desset.lat/'),'empresa.html':html('https://desset.lat/empresa'),'comercios.html':html('https://desset.lat/comercios'),'repartidores.html':html('https://desset.lat/repartidores'),'prime.html':html('https://desset.lat/prime'),'contacto.html':html('https://desset.lat/contacto'),'confianza.html':html('https://desset.lat/confianza'),'noticias.html':html('https://desset.lat/noticias'),'talento.html':html('https://desset.lat/talento'),'en.html':html('https://desset.lat/en'),'registro-comercios.html':html('https://desset.lat/registro-comercios'),'incorporacion-comercios.html':html('https://desset.lat/incorporacion-comercios'),'registro-repartidores.html':html('https://desset.lat/registro-repartidores'),'incorporacion-repartidores.html':html('https://desset.lat/incorporacion-repartidores'),'capacitacion-repartidores.html':html('https://desset.lat/capacitacion-repartidores'),'aplicaciones.html':html('https://desset.lat/aplicaciones'),'aplicaciones-clientes.html':html('https://desset.lat/aplicaciones-clientes'),'aplicaciones-comercios.html':html('https://desset.lat/aplicaciones-comercios'),'aplicaciones-repartidores.html':html('https://desset.lat/aplicaciones-repartidores'),'styles-applications.css':'.apps-page{}','styles-onboarding.css':'.onboarding-page{}','404.html':'not found','_headers':'policy','robots.txt':'Disallow: /','sitemap.xml':'empty','styles.css':'body{}','styles-audiences.css':'.audience-page{}','styles-prime.css':'.prime-page{}','styles-contact.css':'.contact-page{}','styles-trust.css':'.trust-page{}','styles-news.css':'.news-page{}','styles-careers.css':'.careers-page{}'};
 for(let i=0;i<31;i++)map['assets/test-'+i+'.webp']='asset '+i;
 for(const path of primePhotos)map[path]='approved '+path;
 map['assets/talento-cultura.webp']='approved talent photo';
 map['assets/talento-equipo.webp']='approved homepage talent photo';
 for(const path of ["assets/servicio-desset.mp4","assets/servicio-prime.mp4","assets/servicio-desset-poster.webp","assets/servicio-prime-poster.webp","styles-service-video.css"])map[path]='approved '+path;
 map['assets/repartidores-hero-original.jpg']='approved rider portrait';
 map['assets/comercios-hero-minimercado.webp']='approved merchant hero photo';
 const assets=Object.entries(map).map(([path,value])=>{const b=Buffer.from(value);mkdirSync(dirname(join(dir,path)),{recursive:true});writeFileSync(join(dir,path),b);return {path,bytes:b.length,sha256:hash(b)}});
 const reportPath=join(root,'report.json');writeFileSync(reportPath,JSON.stringify({schema:'desset-prime-manual-release-package-v1',seo_policy:'NOINDEX',production_authorized:false,production_deployed:false,package_files:78,assets,assets_manifest_sha256:hash(Buffer.from(JSON.stringify(assets)))}));
 const requests=[],logs=[];
 const mock=(url,opts)=>{requests.push([url,opts.method]);const p=new URL(url).pathname;const k=p==='/'?'index.html':p==='/empresa'?'empresa.html':p==='/comercios'?'comercios.html':p==='/repartidores'?'repartidores.html':p==='/prime'?'prime.html':p==='/contacto'?'contacto.html':p==='/confianza'?'confianza.html':p==='/noticias'?'noticias.html':p==='/talento'?'talento.html':p==='/en'?'en.html':p==='/registro-comercios'?'registro-comercios.html':p==='/incorporacion-comercios'?'incorporacion-comercios.html':p==='/registro-repartidores'?'registro-repartidores.html':p==='/incorporacion-repartidores'?'incorporacion-repartidores.html':p==='/capacitacion-repartidores'?'capacitacion-repartidores.html':p==='/aplicaciones'?'aplicaciones.html':p==='/aplicaciones-clientes'?'aplicaciones-clientes.html':p==='/aplicaciones-comercios'?'aplicaciones-comercios.html':p==='/aplicaciones-repartidores'?'aplicaciones-repartidores.html':p==='/__desset_prime_missing_path__'?'404.html':p.slice(1);return new Response(map[k]??'missing',{status:k==='404.html'?404:200,headers:{'content-type':'text/html','content-security-policy':"default-src 'self'",'x-content-type-options':'nosniff'}})};
 return {opts:{publicDir:dir,reportPath,request:mock,attempts:2,delay:0,log:l=>logs.push(l)},requests,logs,mock};
}
test('exact public bytes, both hosts, both company paths, revision and 404',async t=>{
 const f=fixture(t);assert.equal((await verifyLive(f.opts)).result,'PASS');
 assert.ok(f.requests.every(x=>x[1]==='GET'));assert.ok(f.requests.some(x=>x[0].includes('/empresa.html')));assert.ok(f.requests.some(x=>x[0].includes('/comercios.html')));assert.ok(f.requests.some(x=>x[0].includes('/repartidores.html')));assert.ok(f.requests.some(x=>x[0].includes('/prime.html')));assert.ok(f.requests.some(x=>x[0].endsWith('/prime')));assert.ok(f.requests.some(x=>x[0].endsWith('/contacto')));assert.ok(f.requests.some(x=>x[0].endsWith('/contacto.html')));assert.ok(f.requests.some(x=>x[0].endsWith('/confianza')));assert.ok(f.requests.some(x=>x[0].endsWith('/confianza.html')));assert.ok(f.requests.some(x=>x[0].endsWith('/noticias')));assert.ok(f.requests.some(x=>x[0].endsWith('/noticias.html')));assert.ok(f.requests.some(x=>x[0].endsWith('/talento')));assert.ok(f.requests.some(x=>x[0].endsWith('/talento.html')));assert.ok(f.requests.some(x=>x[0].endsWith('/en')));assert.ok(f.requests.some(x=>x[0].endsWith('/en.html')));assert.ok(f.requests.some(x=>x[0].includes('styles.css?v=')));
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

test('rejects the obsolete 54-file manifest before any HTTP request',async t=>{
 const f=fixture(t),m=JSON.parse(readFileSync(f.opts.reportPath,'utf8'));
 m.package_files=57;m.assets=m.assets.filter(a=>!primePhotos.includes(a.path));
 m.assets_manifest_sha256=hash(Buffer.from(JSON.stringify(m.assets)));
 writeFileSync(f.opts.reportPath,JSON.stringify(m));
 await assert.rejects(verifyLive(f.opts),/unverified package manifest/);
 assert.equal(f.requests.length,0);
});
test('actual generated NOINDEX package is accepted, and all six photographs are checked on both domains',async t=>{
 const root=mkdtempSync(join(tmpdir(),'prime-real-live-'));t.after(()=>rmSync(root,{recursive:true,force:true}));
 const publicDir=join(root,'public'),evidenceDir=join(root,'evidence');
 const dist=fileURLToPath(new URL('../dist/',import.meta.url));
 const report=preparePrimeCutoverPackage({dist,sourceSha:'0c39d00af1f5401710bbc00b52147b108f563968',seoPolicy:'NOINDEX',outputDir:publicDir,evidenceDir});
 assert.equal(report.package_files,78);
 const reportPath=join(evidenceDir,'prime-manual-release-package.json');
 const requests=[],map=new Map(report.assets.map(a=>[a.path,readFileSync(join(publicDir,a.path))]));
 const request=(url,opts)=>{
  requests.push(url);assert.equal(opts.method,'GET');
  const p=new URL(url).pathname;
  const k=p==='/'?'index.html':p==='/__desset_prime_missing_path__'?'404.html':map.has(p.slice(1))?p.slice(1):p.slice(1)+'.html';
  assert.ok(map.has(k),'unexpected URL '+url);
  return new Response(map.get(k),{status:k==='404.html'?404:200,headers:{'content-type':'text/html','content-security-policy':"default-src 'self'",'x-content-type-options':'nosniff'}});
 };
 assert.equal((await verifyLive({publicDir,reportPath,request,attempts:1,delay:0,log:()=>{}})).result,'PASS');
 for(const origin of ['https://desset.lat','https://www.desset.lat'])for(const path of primePhotos)assert.ok(requests.includes(origin+'/'+path),path);
});
