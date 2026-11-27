import {companyRoutes} from "./company-routes.mjs";
import {appPages,assertClosedDistribution,assertClosedAppPage} from "./app-distribution-contract.mjs";
/**
 * Generate a RELEASE-SHAPED static folder from the native DESSET Prime artifact.
 * This never deploys; publishing is exclusively a gated workflow action.
 * The source manifest and ALL brand/3D files are verified before transformation.
 */
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync,cpSync,existsSync,lstatSync,rmSync,readdirSync,mkdirSync} from 'node:fs';
import {join,resolve,isAbsolute,dirname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {preparePrimeHosting} from './prime-hosting-candidate.mjs';
import {generateThirdPartyNotices} from './prime-third-party-notices.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sha256=b=>createHash('sha256').update(b).digest('hex');
const requiredSpecial=['index.html','empresa.html','comercios.html','repartidores.html','prime.html','contacto.html','confianza.html','noticias.html','talento.html','en.html','registro-comercios.html','incorporacion-comercios.html','registro-repartidores.html','incorporacion-repartidores.html','capacitacion-repartidores.html','aplicaciones.html','aplicaciones-clientes.html','aplicaciones-comercios.html','aplicaciones-repartidores.html','styles-onboarding.css','styles-applications.css','styles-audiences.css','styles-prime.css','styles-contact.css','styles-trust.css','styles-news.css','styles-careers.css','_headers','robots.txt','sitemap.xml','404.html','THIRD-PARTY-NOTICES.txt',
 'fonts/LICENSE-Inter-OFL.txt','fonts/LICENSE-Plus-Jakarta-Sans-OFL.txt'];
const assert=(condition,message)=>{if(!condition)throw Error('NO-GO: '+message)};
const canonical='https://desset.lat/';
const extraHead='  <meta property="og:title" content="DESSET — Comercio en movimiento">\n'+
 '  <meta property="og:description" content="DESSET conecta comercio, tecnología y logística. Conoce nuestra visión y los servicios en desarrollo.">\n'+
 '  <meta property="og:image" content="https://desset.lat/assets/desset-hero-entrega-dos-espejos.webp">\n'+
 '  <meta name="twitter:card" content="summary_large_image">\n';
function seoVariant(html,policy){
 assert(html.includes('<meta name="robots" content="noindex,nofollow">'),'Prime noindex source changed');
 assert(html.includes('<link rel="canonical" href="'+canonical+'">'),'Canonical not verified');
 assert(html.includes('<meta property="og:url" content="'+canonical+'">'),'OG URL not verified');
 assert(!html.includes('property="og:title"'),'Duplicate SEO metadata');
 let result=html.replace('</head>',extraHead+'</head>');
 if(policy==='INDEX')result=result.replace('<meta name="robots" content="noindex,nofollow">','<meta name="robots" content="index,follow">');
 return result;
}
export function preparePrimeCutoverPackage({dist,sourceSha,seoPolicy,outputDir,evidenceDir}){
 assert(seoPolicy==='INDEX'||seoPolicy==='NOINDEX','SEO choice missing');
 assert(isAbsolute(dist)&&isAbsolute(outputDir)&&isAbsolute(evidenceDir),'all paths must be absolute');
 const output=resolve(outputDir),evidence=resolve(evidenceDir),source=resolve(dist);
 assert(output!==source&&!output.startsWith(source+sep)&&!source.startsWith(output+sep),'cannot overwrite source site');
 assert(output!==root&&!output.startsWith(root+sep)&&!root.startsWith(output+sep),'package must be outside Git checkout');
 assert(evidence!==output&&!evidence.startsWith(output+sep)&&!output.startsWith(evidence+sep),'evidence cannot sit inside published directory');
 assert(!existsSync(outputDir)&&!existsSync(evidenceDir),'output and evidence paths must not already exist');
 assert(!process.env.CLOUDFLARE_API_TOKEN&&!process.env.CF_API_TOKEN,'build phase must never have Cloudflare token');
 const scratch=preparePrimeHosting({dist,sourceSha,mode:'LOCAL_REHEARSAL_ONLY'});
 try{
  cpSync(scratch.publicDir,output,{recursive:true,force:false,errorOnExist:true});
  const htmlPath=join(output,'index.html'),headersPath=join(output,'_headers');
  writeFileSync(htmlPath,seoVariant(readFileSync(htmlPath,'utf8'),seoPolicy));
  const origHeaders=readFileSync(headersPath,'utf8');
  assert(origHeaders.startsWith('/*\n')&&!origHeaders.includes('Cache-Control'),'Unexpected header policy');
  writeFileSync(headersPath,origHeaders+'  Cache-Control: no-cache, must-revalidate\n');
  const robots=seoPolicy==='INDEX'?
    'User-agent: *\nAllow: /\nSitemap: https://desset.lat/sitemap.xml\n' :
    'User-agent: *\nDisallow: /\n';
  const sitemap=seoPolicy==='INDEX'?
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://desset.lat/</loc></url></urlset>\n':
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n';
  writeFileSync(join(output,'robots.txt'),robots);
  writeFileSync(join(output,'sitemap.xml'),sitemap);
  const notices=generateThirdPartyNotices();
  writeFileSync(join(output,'THIRD-PARTY-NOTICES.txt'),notices.text,{flag:'wx'});
  // Must not copy any original manifest: public directory is static-only and exact.
  const expected=new Set([...scratch.report.assets.map(x=>x.path),'THIRD-PARTY-NOTICES.txt']);
  let paths=[];function scan(dir,prefix=''){
   for(const name of readdirSync(dir)){
     const rel=prefix?prefix+'/'+name:name,full=join(dir,name),st=lstatSync(full);
     assert(!st.isSymbolicLink(),'Symlink in release package');
     if(st.isDirectory())scan(full,rel);else{assert(st.isFile(),'Not a regular file in package');paths.push(rel);}
   }
  }scan(output);
  assert(paths.length===92&&paths.every(x=>expected.has(x)),'Unexpected candidate inventory');
  for(const path of requiredSpecial)assert(paths.includes(path),'Missing required static host policy '+path);
  const modifiable=new Set(['index.html','_headers','robots.txt','sitemap.xml','THIRD-PARTY-NOTICES.txt']);
  const inventory=paths.sort().map(path=>{
    const bytes=readFileSync(join(output,path));
    const initial=scratch.report.assets.find(x=>x.path===path);
    if(!modifiable.has(path))assert(bytes.length===initial.bytes&&sha256(bytes)===initial.sha256,'Prime media/code asset mutated: '+path);
    return {path,bytes:bytes.length,sha256:sha256(bytes)};
  });
  const merchant=readFileSync(join(output,'comercios.html'),'utf8');
  assert(merchant.includes('name="robots" content="noindex,nofollow"')&&merchant.includes('rel="canonical" href="https://desset.lat/comercios"'),'Merchant page must remain noindex');
  const rider=readFileSync(join(output,'repartidores.html'),'utf8');
  assert(rider.includes('name="robots" content="noindex,nofollow"')&&rider.includes('rel="canonical" href="https://desset.lat/repartidores"'),'Rider page must remain noindex');
  const prime=readFileSync(join(output,'prime.html'),'utf8');
  assert(prime.includes('name="robots" content="noindex,nofollow"')&&prime.includes('rel="canonical" href="https://desset.lat/prime"'),'Prime page must remain noindex');
  const contact=readFileSync(join(output,'contacto.html'),'utf8');
  assert(contact.includes('name="robots" content="noindex,nofollow"')&&contact.includes('rel="canonical" href="https://desset.lat/contacto"'),'Contact page must remain noindex');
  const trust=readFileSync(join(output,'confianza.html'),'utf8');
  assert(trust.includes('name="robots" content="noindex,nofollow"')&&trust.includes('rel="canonical" href="https://desset.lat/confianza"'),'Trust page must remain noindex');
  const news=readFileSync(join(output,'noticias.html'),'utf8');
  assert(news.includes('name="robots" content="noindex,nofollow"')&&news.includes('rel="canonical" href="https://desset.lat/noticias"'),'News page must remain noindex');
  const careers=readFileSync(join(output,'talento.html'),'utf8');
  assert(careers.includes('name="robots" content="noindex,nofollow"')&&careers.includes('rel="canonical" href="https://desset.lat/talento"'),'Careers page must remain noindex');
  const english=readFileSync(join(output,'en.html'),'utf8');
  assert(english.includes('name="robots" content="noindex,nofollow"')&&english.includes('rel="canonical" href="https://desset.lat/en"'),'English page must remain noindex');
  const registration=readFileSync(join(output,'registro-comercios.html'),'utf8');
  assert(registration.includes('name="robots" content="noindex,nofollow"')&&registration.includes('rel="canonical" href="https://desset.lat/registro-comercios"'),'Registration page must remain noindex');
  const guide=readFileSync(join(output,'incorporacion-comercios.html'),'utf8');
  assert(guide.includes('name="robots" content="noindex,nofollow"')&&guide.includes('rel="canonical" href="https://desset.lat/incorporacion-comercios"'),'Guide page must remain noindex');
  for(const name of ["registro-repartidores","incorporacion-repartidores","capacitacion-repartidores"]){const p=readFileSync(join(output,name+'.html'),'utf8');assert(p.includes('name="robots" content="noindex,nofollow"')&&p.includes('rel="canonical" href="https://desset.lat/'+name+'"'),'Rider onboarding canonical or indexing gate: '+name);}
  const company=readFileSync(join(output,'empresa.html'),'utf8');
 for(const name of companyRoutes){const p=readFileSync(join(output,name+'.html'),'utf8');assert(p.includes('name="robots" content="noindex,nofollow"')&&p.includes('rel="canonical" href="https://desset.lat/'+name+'"'),'Company detail canonical or indexing gate: '+name);}
  assert(company.includes('name="robots" content="noindex,nofollow"')&&company.includes('rel="canonical" href="https://desset.lat/empresa"'),'Company page must remain noindex independently of homepage policy');
 for(const name of appPages){const p=readFileSync(join(output,name+'.html'),'utf8');assertClosedAppPage(p,name);assert(p.includes('rel="canonical" href="https://desset.lat/'+name+'"'),'App directory canonical missing: '+name);}
  const outHtml=readFileSync(htmlPath,'utf8');
  assert(outHtml.includes('rel="canonical" href="'+canonical+'"'),'Canonical absent');
  assert(outHtml.includes('property="og:image" content="https://desset.lat/assets/desset-hero-entrega-dos-espejos.webp"'),'OG image missing');
  assert(outHtml.includes('name="robots" content="'+(seoPolicy==='INDEX'?'index,follow':'noindex,nofollow')+'"'),'Unexpected robots meta');
  assert(readFileSync(join(output,'robots.txt'),'utf8')===robots,'robots policy wrong');
  assert(sha256(readFileSync(join(output,'THIRD-PARTY-NOTICES.txt')))===notices.sha256,'third-party license notice changed');
  const result={schema:'desset-prime-manual-release-package-v1',source_repository:'M0-coder/DESSET-prime',source_sha:sourceSha,
    project:'desset-institucional',seo_policy:seoPolicy,canonical,
    original_files:scratch.report.original_files,package_files:inventory.length,
    third_party_notice_sha256:notices.sha256,
    third_party_licenses:notices.info,
    assets:inventory,assets_manifest_sha256:sha256(Buffer.from(JSON.stringify(inventory))),
    production_authorized:false,production_deployed:false,
    security:'Fails closed if unexpected files/bytes/policy are present. This artifact alone is NOT release authorization.'};
  mkdirSync(evidence,{recursive:false});
  writeFileSync(join(evidence,'prime-manual-release-package.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  return result;
 }catch(e){
  // Only newly created disposable paths may be deleted; old source remains untouched.
  if(existsSync(output))rmSync(output,{recursive:true,force:true});
  if(existsSync(evidence))rmSync(evidence,{recursive:true,force:true});
  throw e;
 }finally{rmSync(scratch.staging,{recursive:true,force:true});}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const [dist,sourceSha,seoPolicy,outputDir,evidenceDir]=process.argv.slice(2);
  const report=preparePrimeCutoverPackage({dist,sourceSha,seoPolicy,outputDir,evidenceDir});
  console.log(JSON.stringify({files:report.package_files,sha:report.source_sha,seo:report.seo_policy,deployed:false},null,2));
 }catch(e){console.error(e.message);process.exitCode=1}
}
