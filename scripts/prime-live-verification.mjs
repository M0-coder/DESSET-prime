/** GET-only public verification. Never changes deployment, cache or DNS. */
import {readFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {setTimeout as sleep} from 'node:timers/promises';
const hash=b=>createHash('sha256').update(b).digest('hex');
const origins=['https://desset.lat','https://www.desset.lat'];
const allowed=new Set(origins);
const headersRequired=['content-security-policy','x-content-type-options'];
export async function verifyLive({publicDir,reportPath,request=fetch,attempts=5,delay=3000,log=console.log}){
 const m=JSON.parse(readFileSync(reportPath,'utf8'));
 if(m.schema!=='desset-prime-manual-release-package-v1'||m.seo_policy!=='NOINDEX'||m.production_authorized!==false||m.production_deployed!==false||m.package_files!==69||m.assets?.length!==69||m.assets.some(a=>/^assets\/roles-geometry-/.test(a.path))||hash(Buffer.from(JSON.stringify(m.assets)))!==m.assets_manifest_sha256)throw Error('NO-GO: unverified package manifest');
 const paths=new Set();
 for(const a of m.assets){
  if(typeof a.path!=='string'||a.path.startsWith('/')||a.path.split('/').some(p=>!p||p==='.'||p==='..')||!(/^[a-z0-9_.\/-]+$/.test(a.path)||a.path==='THIRD-PARTY-NOTICES.txt'||/^fonts\/LICENSE-(?:Inter|Plus-Jakarta-Sans)-OFL\.txt$/.test(a.path))||paths.has(a.path))throw Error('NO-GO: invalid or duplicate asset');
  paths.add(a.path);
  const b=readFileSync(join(publicDir,a.path));
  if(b.length!==a.bytes||hash(b)!==a.sha256)throw Error('NO-GO: local package mismatch '+a.path);
 }
 for(const p of ['index.html','empresa.html','comercios.html','repartidores.html','prime.html','contacto.html','confianza.html','noticias.html','talento.html','en.html','registro-comercios.html','incorporacion-comercios.html','registro-repartidores.html','incorporacion-repartidores.html','capacitacion-repartidores.html','aplicaciones.html','aplicaciones-clientes.html','aplicaciones-comercios.html','aplicaciones-repartidores.html','styles-onboarding.css','styles-applications.css','styles-audiences.css','styles-prime.css','styles-contact.css','styles-trust.css','styles-news.css','styles-careers.css','404.html','_headers','robots.txt','sitemap.xml','assets/prime-hero-logistica.webp','assets/prime-paqueteria.webp','assets/prime-distribucion.webp','assets/prime-fulfillment.webp','assets/prime-tecnologia-logistica.webp','assets/prime-vision-internacional.webp'])if(!paths.has(p))throw Error('NO-GO: missing '+p);
 async function get(url){
  for(let i=0;i<5;i++){
   if(!allowed.has(new URL(url).origin))throw Error('unexpected redirect origin');
   const r=await request(url,{method:'GET',redirect:'manual',headers:{'Cache-Control':'no-cache','Pragma':'no-cache'},signal:AbortSignal.timeout(12000)});
   if([301,302,303,307,308].includes(r.status)){
    const loc=r.headers.get('location');if(!loc)throw Error('redirect without location');
    url=new URL(loc,url).href;continue;
   }
   return {r,url,bytes:Buffer.from(await r.arrayBuffer())};
  }
  throw Error('too many redirects');
 }
 const failures=[];
 async function probe(origin,route,a,status=200,html=false){
  const url=origin+route;
  for(let i=1;i<=attempts;i++){
   try{
    const {r,url:final,bytes}=await get(url);
    const actual=hash(bytes),bad=[];
    if(r.status!==status)bad.push('HTTP '+r.status+' expected '+status);
    if(actual!==a.sha256||bytes.length!==a.bytes)bad.push('bytes/SHA256 differ');
    if(html){
     const body=bytes.toString('utf8');
     const canonical='https://desset.lat'+route.replace(/\.html$/,'');
     if(!body.includes('rel="canonical" href="'+canonical+'"'))bad.push('canonical mismatch');
     if(!body.includes('name="robots" content="noindex,nofollow"'))bad.push('NOINDEX missing');
     if(!r.headers.get('content-type')?.includes('text/html'))bad.push('HTML content-type missing');
     for(const h of headersRequired)if(!r.headers.get(h))bad.push('missing '+h);
    }
    const record={url,final,attempt:i,status:r.status,cache:r.headers.get('cf-cache-status'),expected_sha256:a.sha256,actual_sha256:actual,expected_bytes:a.bytes,actual_bytes:bytes.length,issues:bad};
    log(JSON.stringify(record));
    if(!bad.length)return;
    if(i===attempts)failures.push(record);
   }catch(e){
    const record={url,attempt:i,issues:[String(e.message||e)]};log(JSON.stringify(record));if(i===attempts)failures.push(record);
   }
   if(i<attempts)await sleep(delay);
  }
 }
 for(const origin of origins){
  const jobs=m.assets.filter(a=>a.path!=='_headers'&&a.path!=='404.html').map(a=>({a,route:a.path==='index.html'?'/':['empresa.html','comercios.html','repartidores.html','prime.html','contacto.html','confianza.html','noticias.html','talento.html','en.html','registro-comercios.html','incorporacion-comercios.html','registro-repartidores.html','incorporacion-repartidores.html','capacitacion-repartidores.html','aplicaciones.html','aplicaciones-clientes.html','aplicaciones-comercios.html','aplicaciones-repartidores.html'].includes(a.path)?'/'+a.path.replace(/\.html$/,''):'/'+a.path,html:['index.html','empresa.html','comercios.html','repartidores.html','prime.html','contacto.html','confianza.html','noticias.html','talento.html','en.html','registro-comercios.html','incorporacion-comercios.html','registro-repartidores.html','incorporacion-repartidores.html','capacitacion-repartidores.html','aplicaciones.html','aplicaciones-clientes.html','aplicaciones-comercios.html','aplicaciones-repartidores.html'].includes(a.path)}));
  // Validate actual stylesheet URL as used by browsers, not just the bare filename.
  const rev=readFileSync(join(publicDir,'index.html'),'utf8').match(/href="\.\/styles\.css\?v=([a-f0-9]{40})"/)?.[1];
  if(!rev)throw Error('NO-GO: missing CSS revision');
  jobs.push({a:m.assets.find(a=>a.path==='styles.css'),route:'/styles.css?v='+rev});
  jobs.push({a:m.assets.find(a=>a.path==='empresa.html'),route:'/empresa.html',html:true});
  jobs.push({a:m.assets.find(a=>a.path==='comercios.html'),route:'/comercios.html',html:true});
  jobs.push({a:m.assets.find(a=>a.path==='repartidores.html'),route:'/repartidores.html',html:true});
  jobs.push({a:m.assets.find(a=>a.path==='prime.html'),route:'/prime.html',html:true});
  jobs.push({a:m.assets.find(a=>a.path==='contacto.html'),route:'/contacto.html',html:true});
  jobs.push({a:m.assets.find(a=>a.path==='confianza.html'),route:'/confianza.html',html:true});
  jobs.push({a:m.assets.find(a=>a.path==='noticias.html'),route:'/noticias.html',html:true});
  jobs.push({a:m.assets.find(a=>a.path==='talento.html'),route:'/talento.html',html:true});
  jobs.push({a:m.assets.find(a=>a.path==='en.html'),route:'/en.html',html:true});
  jobs.push({a:m.assets.find(a=>a.path==='registro-comercios.html'),route:'/registro-comercios.html',html:true});
  jobs.push({a:m.assets.find(a=>a.path==='incorporacion-comercios.html'),route:'/incorporacion-comercios.html',html:true});
  for(const name of ["registro-repartidores","incorporacion-repartidores","capacitacion-repartidores"])jobs.push({a:m.assets.find(a=>a.path===name+'.html'),route:'/'+name+'.html',html:true});
  for(const name of ["aplicaciones","aplicaciones-clientes","aplicaciones-comercios","aplicaciones-repartidores"])jobs.push({a:m.assets.find(a=>a.path===name+'.html'),route:'/'+name+'.html',html:true});
  for(let i=0;i<jobs.length;i+=6)await Promise.all(jobs.slice(i,i+6).map(j=>probe(origin,j.route,j.a,200,j.html)));
  await probe(origin,'/__desset_prime_missing_path__',m.assets.find(a=>a.path==='404.html'),404);
 }
 if(failures.length)throw Error('PUBLIC LIVE FAIL '+JSON.stringify(failures));
 log('PUBLIC LIVE SMOKE PASS: both domains, exact package bytes, company routes, versioned CSS and 404');
 return {result:'PASS',origins,failures};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await verifyLive({publicDir:process.argv[2],reportPath:process.argv[3]});}
 catch(e){console.error(e.message);process.exitCode=1;}
}
