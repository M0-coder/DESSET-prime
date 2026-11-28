import {companyRoutes} from "./company-routes.mjs";
import {institutionalSitemap,assertSeoPage} from "./prime-institutional-seo.mjs";
import {appPages,assertClosedDistribution,assertClosedAppPage} from "./app-distribution-contract.mjs";
/** Independent offline verifier for Prime's optional MANUAL publication package. */
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
const hash=b=>createHash('sha256').update(b).digest('hex');
const check=(v,s)=>{if(!v)throw Error('NO-GO: '+s)};
export function verifyManualPackage({publicDir,reportPath,sourceSha,seoPolicy}){
 check(isAbsolute(publicDir)&&isAbsolute(reportPath),'Absolute paths required');
 const m=JSON.parse(readFileSync(reportPath,'utf8'));
 check(m.schema==='desset-prime-manual-release-package-v1'&&m.source_repository==='M0-coder/DESSET-prime','Unrecognized report');
 check(/^[a-f0-9]{40}$/.test(sourceSha)&&m.source_sha===sourceSha,'Git commit identity changed');
 check(['INDEX','NOINDEX'].includes(seoPolicy)&&seoPolicy===m.seo_policy,'SEO policy differs');
 check(m.project==='desset-institucional'&&m.canonical==='https://desset.lat/','Wrong Pages destination');
 check(m.production_authorized===false&&m.production_deployed===false,'Report attempts to authorize production');
 check(m.original_files===89&&m.package_files===93&&Array.isArray(m.assets)&&m.assets.length===93,'Missing/extra source assets');
 check(hash(Buffer.from(JSON.stringify(m.assets)))===m.assets_manifest_sha256,'Manifest SHA changed');
 const want=new Map(),seen=new Set();
 for(const a of m.assets){
  check(typeof a.path==='string'&&(/^[a-z0-9_.\/-]+$/.test(a.path)||a.path==='THIRD-PARTY-NOTICES.txt'||/^fonts\/LICENSE-(?:Inter|Plus-Jakarta-Sans)-OFL\.txt$/.test(a.path))&&!a.path.startsWith('/')&&
    !a.path.split('/').some(s=>!s||s==='.'||s==='..')&&!want.has(a.path)&&!/^assets\/roles-geometry-/.test(a.path),'Unsafe, retired or repeated path');
  check(Number.isSafeInteger(a.bytes)&&a.bytes>0&&/^[a-f0-9]{64}$/.test(a.sha256),'Invalid expected file hash');
  want.set(a.path,a);
 }
 function scan(dir,prefix=''){
  for(const name of readdirSync(dir)){
   const rel=prefix?prefix+'/'+name:name,full=join(dir,name),stat=lstatSync(full);
   check(!stat.isSymbolicLink(),'Symlink forbidden: '+rel);
   if(stat.isDirectory())scan(full,rel);
   else {check(stat.isFile()&&!seen.has(rel),'Not a regular file: '+rel);seen.add(rel);}
  }
 }
 scan(publicDir);check(seen.size===93,'Unexpected file count');
 for(const path of seen)check(want.has(path),'Unexpected file: '+path);
 for(const [path,spec] of want){
  check(seen.has(path),'Missing file: '+path);
  const bytes=readFileSync(join(publicDir,path));
  check(bytes.length===spec.bytes&&hash(bytes)===spec.sha256,'File differs: '+path);
 }
 const notices=readFileSync(join(publicDir,'THIRD-PARTY-NOTICES.txt'),'utf8');
 check(m.third_party_notice_sha256===hash(Buffer.from(notices)),'Third-party license SHA does not match evidence');
 check(Array.isArray(m.third_party_licenses)&&m.third_party_licenses.length===2,'Missing third-party license descriptors');
 for(const pkg of ['three','esbuild']){
  const info=m.third_party_licenses.find(x=>x.package===pkg);
  check(info?.license==='MIT'&&notices.includes(pkg+' '+info.version+' (MIT)'),'Missing installed-package MIT notice for '+pkg);
 }
 check((notices.match(/Permission is hereby granted/g)||[]).length===2,'Full MIT permission terms missing');
 check(!notices.includes('PROPRIETARY'),'Third-party license misclassified');
 const html=readFileSync(join(publicDir,'index.html'),'utf8');
 const merchant=readFileSync(join(publicDir,'comercios.html'),'utf8');
 assertSeoPage(merchant,'comercios',seoPolicy);
 const rider=readFileSync(join(publicDir,'repartidores.html'),'utf8');
 assertSeoPage(rider,'repartidores',seoPolicy);
 const prime=readFileSync(join(publicDir,'prime.html'),'utf8');
 assertSeoPage(prime,'prime',seoPolicy);
 const contact=readFileSync(join(publicDir,'contacto.html'),'utf8');
 assertSeoPage(contact,'contacto',seoPolicy);
 const trust=readFileSync(join(publicDir,'confianza.html'),'utf8');
 assertSeoPage(trust,'confianza',seoPolicy);
 const news=readFileSync(join(publicDir,'noticias.html'),'utf8');
 assertSeoPage(news,'noticias',seoPolicy);
 const careers=readFileSync(join(publicDir,'talento.html'),'utf8');
 assertSeoPage(careers,'talento',seoPolicy);
 const english=readFileSync(join(publicDir,'en.html'),'utf8');
 assertSeoPage(english,'en',seoPolicy);
 const registration=readFileSync(join(publicDir,'registro-comercios.html'),'utf8');
 check(registration.includes('name="robots" content="noindex,nofollow"')&&registration.includes('rel="canonical" href="https://desset.lat/registro-comercios"'),'Registration page canonical or noindex changed');
 const guide=readFileSync(join(publicDir,'incorporacion-comercios.html'),'utf8');
 check(guide.includes('name="robots" content="noindex,nofollow"')&&guide.includes('rel="canonical" href="https://desset.lat/incorporacion-comercios"'),'Guide page canonical or noindex changed');
 for(const name of ["registro-repartidores","incorporacion-repartidores","capacitacion-repartidores"]){const p=readFileSync(join(publicDir,name+'.html'),'utf8');check(p.includes('name="robots" content="noindex,nofollow"')&&p.includes('rel="canonical" href="https://desset.lat/'+name+'"'),'Rider onboarding canonical or indexing gate: '+name);}
 const company=readFileSync(join(publicDir,'empresa.html'),'utf8');
 for(const name of companyRoutes){const p=readFileSync(join(publicDir,name+'.html'),'utf8');assertSeoPage(p,name,seoPolicy);}
 assertSeoPage(company,'empresa',seoPolicy);
 for(const name of appPages){const p=readFileSync(join(publicDir,name+'.html'),'utf8');assertClosedAppPage(p,name);check(p.includes('rel="canonical" href="https://desset.lat/'+name+'"'),'App directory canonical missing: '+name);}
 const robots=readFileSync(join(publicDir,'robots.txt'),'utf8');
 const map=readFileSync(join(publicDir,'sitemap.xml'),'utf8');
 const head=readFileSync(join(publicDir,'_headers'),'utf8');
 check(html.includes('rel="canonical" href="https://desset.lat/"')&&html.includes('property="og:image"'),'SEO metadata missing');
 check(html.includes('name="robots" content="'+(seoPolicy==='INDEX'?'index,follow':'noindex,nofollow')+'"'),'Robots meta wrong');
 if(seoPolicy==='INDEX'){
  check(robots==='User-agent: *\nAllow: /\nSitemap: https://desset.lat/sitemap.xml\n','Expected indexable robots');
  check(map===institutionalSitemap(seoPolicy),'Institutional sitemap differs from allowlist');
 }else{
  check(robots==='User-agent: *\nDisallow: /\n'&&!map.includes('<loc>'),'Noindex staging not preserved');
 }
 check(map===institutionalSitemap(seoPolicy),'Exact sitemap differs');
 check(head.includes("script-src 'self'")&&head.includes("frame-ancestors 'none'")&&head.includes('Cache-Control: no-cache, must-revalidate'),'Security/caching headers lost');
 check(!seen.has('site-manifest.json')&&!seen.has('prime-manual-release-package.json'),'Private evidence exposed publicly');
 for(const part of ['proveedores','comercios','consumidores','operadores-logisticos']){
  const path='assets/ecosistema-'+part+'.webp';
  check(seen.has(path)&&html.includes('./'+path),'Missing participant photo '+path);
 }
 const status=readFileSync(join(publicDir,'scripts/service-state.js'),'utf8');
 assertClosedDistribution(status);
 return {result:'PASS',source_sha:sourceSha,seo:seoPolicy,files:m.assets.length,production_authorized:false,production_deployed:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const [publicDir,reportPath,sourceSha,seoPolicy]=process.argv.slice(2);
   console.log(JSON.stringify(verifyManualPackage({publicDir,reportPath,sourceSha,seoPolicy}),null,2));
 }catch(e){console.error(e.message);process.exitCode=1}
}
