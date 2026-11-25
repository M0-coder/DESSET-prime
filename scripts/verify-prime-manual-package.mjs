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
 check(m.original_files===45&&m.package_files===49&&Array.isArray(m.assets)&&m.assets.length===49,'Missing/extra source assets');
 check(hash(Buffer.from(JSON.stringify(m.assets)))===m.assets_manifest_sha256,'Manifest SHA changed');
 const want=new Map(),seen=new Set();
 for(const a of m.assets){
  check(typeof a.path==='string'&&(/^[a-z0-9_.\/-]+$/.test(a.path)||a.path==='THIRD-PARTY-NOTICES.txt'||/^fonts\/LICENSE-(?:Inter|Plus-Jakarta-Sans)-OFL\.txt$/.test(a.path))&&!a.path.startsWith('/')&&
    !a.path.split('/').some(s=>!s||s==='.'||s==='..')&&!want.has(a.path),'Unsafe or repeated path');
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
 scan(publicDir);check(seen.size===49,'Unexpected file count');
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
 check(merchant.includes('name="robots" content="noindex,nofollow"')&&merchant.includes('rel="canonical" href="https://desset.lat/comercios"'),'Merchant page canonical or noindex changed');
 const rider=readFileSync(join(publicDir,'repartidores.html'),'utf8');
 check(rider.includes('name="robots" content="noindex,nofollow"')&&rider.includes('rel="canonical" href="https://desset.lat/repartidores"'),'Rider page canonical or noindex changed');
 const prime=readFileSync(join(publicDir,'prime.html'),'utf8');
 check(prime.includes('name="robots" content="noindex,nofollow"')&&prime.includes('rel="canonical" href="https://desset.lat/prime"'),'Prime page canonical or noindex changed');
 const contact=readFileSync(join(publicDir,'contacto.html'),'utf8');
 check(contact.includes('name="robots" content="noindex,nofollow"')&&contact.includes('rel="canonical" href="https://desset.lat/contacto"'),'Contact page canonical or noindex changed');
 const trust=readFileSync(join(publicDir,'confianza.html'),'utf8');
 check(trust.includes('name="robots" content="noindex,nofollow"')&&trust.includes('rel="canonical" href="https://desset.lat/confianza"'),'Trust page canonical or noindex changed');
 const company=readFileSync(join(publicDir,'empresa.html'),'utf8');
 check(company.includes('name="robots" content="noindex,nofollow"')&&company.includes('rel="canonical" href="https://desset.lat/empresa"'),'Company page canonical or noindex changed');
 const robots=readFileSync(join(publicDir,'robots.txt'),'utf8');
 const map=readFileSync(join(publicDir,'sitemap.xml'),'utf8');
 const head=readFileSync(join(publicDir,'_headers'),'utf8');
 check(html.includes('rel="canonical" href="https://desset.lat/"')&&html.includes('property="og:image"'),'SEO metadata missing');
 check(html.includes('name="robots" content="'+(seoPolicy==='INDEX'?'index,follow':'noindex,nofollow')+'"'),'Robots meta wrong');
 if(seoPolicy==='INDEX'){
  check(robots==='User-agent: *\nAllow: /\nSitemap: https://desset.lat/sitemap.xml\n','Expected indexable robots');
  check(map.includes('<loc>https://desset.lat/</loc>'),'Missing sitemap canonical');
 }else{
  check(robots==='User-agent: *\nDisallow: /\n'&&!map.includes('<loc>'),'Noindex staging not preserved');
 }
 check(head.includes("script-src 'self'")&&head.includes("frame-ancestors 'none'")&&head.includes('Cache-Control: no-cache, must-revalidate'),'Security/caching headers lost');
 check(!seen.has('site-manifest.json')&&!seen.has('prime-manual-release-package.json'),'Private evidence exposed publicly');
 for(const part of ['proveedores','comercios','consumidores','operadores-logisticos']){
  const path='assets/ecosistema-'+part+'.webp';
  check(seen.has(path)&&html.includes('./'+path),'Missing participant photo '+path);
 }
 const status=readFileSync(join(publicDir,'scripts/service-state.js'),'utf8');
 check(status.includes('applicationDistribution:"not_published"')&&status.includes('verified:false'),'Application status changed');
 return {result:'PASS',source_sha:sourceSha,seo:seoPolicy,files:49,production_authorized:false,production_deployed:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const [publicDir,reportPath,sourceSha,seoPolicy]=process.argv.slice(2);
   console.log(JSON.stringify(verifyManualPackage({publicDir,reportPath,sourceSha,seoPolicy}),null,2));
 }catch(e){console.error(e.message);process.exitCode=1}
}
