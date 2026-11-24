/**
 * Prime-only hosting integration: OFFLINE LOCAL REHEARSAL. Not a deployment tool.
 * Produces a temporary website rooted at /tmp, plus an audit outside public/.
 * Uses only DESSET-prime's own dist/site-manifest.json and original assets.
 */
import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, readdirSync, lstatSync, constants} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,isAbsolute,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const self=fileURLToPath(import.meta.url);
const sha256=b=>createHash('sha256').update(b).digest('hex');
const EXACT= /^[a-f0-9]{40}$/;
const OUTPUT_PREFIX='desset-prime-host-rehearsal-';
const BASE_ORIGIN='https://desset.lat/';
const EXTRAS=Object.freeze({
 'robots.txt':'User-agent: *\nDisallow: /\n',
 'sitemap.xml':'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n',
 '404.html':'<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DESSET — Página no encontrada</title></head><body><main><h1>Página no encontrada</h1><p>La dirección solicitada no existe.</p><a href="/">Volver al inicio</a></main></body></html>\n'
});
const REQUIRED=['index.html','empresa.html','comercios.html','repartidores.html','_headers','scripts/service-state.js','assets/deliver-assets-mark.png','assets/scene-choose.webp','assets/scene-prepare.webp','assets/scene-move.webp','assets/ecosistema-proveedores.webp','assets/ecosistema-comercios.webp','assets/ecosistema-consumidores.webp','assets/ecosistema-operadores-logisticos.webp','assets/v62-commerce.glb','assets/v62-courier.glb','assets/v62-destination.glb',
 'styles-typography.css','styles-audiences.css','fonts/inter-latin-variable.woff2','fonts/plus-jakarta-sans-latin-variable.woff2',
 'fonts/LICENSE-Inter-OFL.txt','fonts/LICENSE-Plus-Jakarta-Sans-OFL.txt'];

function safeName(name){return typeof name==='string'&&(/^[a-z0-9_.\/-]+$/.test(name)||/^fonts\/LICENSE-(?:Inter|Plus-Jakarta-Sans)-OFL\.txt$/.test(name))&&!name.startsWith('/')&&!name.split('/').some(part=>!part||part==='.'||part==='..');}
function assert(ok,message){if(!ok)throw Error('NO-GO: '+message)}
function verifyManifest(dist){
 assert(isAbsolute(dist),'dist path must be absolute');
 const dstat=lstatSync(dist);assert(dstat.isDirectory()&&!dstat.isSymbolicLink(),'dist must be a normal directory');
 const raw=readFileSync(join(dist,'site-manifest.json'));const m=JSON.parse(raw.toString('utf8'));
 assert(m.schema==='desset-prime-static-web-package-v1'&&m.entrypoint==='index.html'&&m.domain==='none'&&m.noindex===true,'source package must remain Prime noindex');
 assert(Array.isArray(m.files)&&m.files.length>=25&&m.files.length<=40,'unexpected Prime asset count');
 const paths=new Set();let size=0;
 for(const f of m.files){
  assert(safeName(f.path)&&!paths.has(f.path),'unsafe or duplicate asset: '+f.path);
  paths.add(f.path);assert(Number.isSafeInteger(f.bytes)&&f.bytes>0&&/^[a-f0-9]{64}$/.test(f.sha256),'invalid asset manifest entry');
  const full=join(dist,f.path);const st=lstatSync(full);
  assert(st.isFile()&&!st.isSymbolicLink(),'asset is not a regular file: '+f.path);
  const buf=readFileSync(full);
  assert(buf.length===f.bytes&&sha256(buf)===f.sha256,'source integrity failed: '+f.path);
  if(f.path.endsWith('.glb'))assert(buf.subarray(0,4).toString()==='glTF'&&buf.readUInt32LE(4)===2,'GLB model invalid');
  size+=buf.length;
 }
 for(const path of REQUIRED)assert(paths.has(path),'mandatory Prime resource missing: '+path);
 assert(size===m.totalBytes,'total source byte count differs');
 const actual=[];
 function walk(dir,prefix=''){
  for(const ent of readdirSync(dir,{withFileTypes:true})){
   const rel=prefix?prefix+'/'+ent.name:ent.name;
   const stat=lstatSync(join(dir,ent.name));
   assert(!stat.isSymbolicLink(),'symlink detected: '+rel);
   if(stat.isDirectory())walk(join(dir,ent.name),rel);
   else {assert(stat.isFile(),'non-file in source');actual.push(rel);}
  }
 }
 walk(dist);
 assert(actual.length===m.files.length+1&&actual.includes('site-manifest.json')&&actual.every(p=>p==='site-manifest.json'||paths.has(p)),'unlisted file(s) in source dist');
 const html=readFileSync(join(dist,'index.html'),'utf8');
 const company=readFileSync(join(dist,'empresa.html'),'utf8');
 const merchant=readFileSync(join(dist,'comercios.html'),'utf8');
 assert(merchant.includes('<meta name="robots" content="noindex,nofollow">')&&!merchant.includes('rel="canonical"'),'Merchant page source indexing changed');
 const rider=readFileSync(join(dist,'repartidores.html'),'utf8');
 assert(rider.includes('<meta name="robots" content="noindex,nofollow">')&&!rider.includes('rel="canonical"'),'Rider page source indexing changed');
 assert(company.includes('<meta name="robots" content="noindex,nofollow">')&&!company.includes('rel="canonical"'),'Company page source indexing changed');
 assert(html.includes('<meta name="robots" content="noindex,nofollow">'),'source noindex changed');
 assert(!/rel="canonical"/.test(html),'source canonical unexpectedly present');
 for(const participant of ['proveedores','comercios','consumidores','operadores-logisticos'])assert(html.includes('./assets/ecosistema-'+participant+'.webp'),'independent participant photograph missing: '+participant);
 const services=readFileSync(join(dist,'scripts/service-state.js'),'utf8');
 assert(services.includes('applicationDistribution:"not_published"')&&services.includes('verified:false'),'unverified app distribution changed');
 const headers=readFileSync(join(dist,'_headers'),'utf8');
 assert(headers.includes("script-src 'self'")&&headers.includes("frame-ancestors 'none'")&&headers.includes('Content-Security-Policy'),'security header missing');
 return {manifest:m,manifestSha256:sha256(raw)};
}
function stageHtml(source,origin=BASE_ORIGIN){
 let html=source;
 assert((html.match(/<\/head>/g)||[]).length===1,'unrecognized head structure');
 assert(!html.includes('rel="canonical"')&&!html.includes('property="og:url"'),'SEO metadata already exists');
 const additions='  <link rel="canonical" href="'+origin+'">\n  <meta property="og:url" content="'+origin+'">\n';
 html=html.replace('</head>',additions+'</head>');
 return html;
}
export function preparePrimeHosting({dist,sourceSha,mode}){
 assert(mode==='LOCAL_REHEARSAL_ONLY','only LOCAL_REHEARSAL_ONLY is accepted');
 assert(!process.env.CLOUDFLARE_API_TOKEN&&!process.env.CF_API_TOKEN&&!process.env.DESSET_RELEASE_APPROVED,'deployment credentials or approval must not be present');
 assert(EXACT.test(sourceSha),'exact 40-character source commit required');
 const {manifest,manifestSha256}=verifyManifest(dist);
 let staging;
 try {
  staging=mkdtempSync(join(tmpdir(),OUTPUT_PREFIX));
  const publicDir=join(staging,'public');mkdirSync(publicDir);
  const inventory=[];
  for(const item of manifest.files){
   const dst=join(publicDir,item.path),src=join(dist,item.path);
   assert(dst.startsWith(publicDir+sep),'copy path escaped output');
   mkdirSync(dirname(dst),{recursive:true});copyFileSync(src,dst,constants.COPYFILE_EXCL);
   let bytes=readFileSync(dst);
   assert(bytes.length===item.bytes&&sha256(bytes)===item.sha256,'copy content changed during transfer: '+item.path);
   if(['index.html','empresa.html','comercios.html','repartidores.html'].includes(item.path)){
    const upgraded=Buffer.from(stageHtml(bytes.toString('utf8'),item.path==='index.html'?BASE_ORIGIN:BASE_ORIGIN+item.path.replace(/\.html$/,'')));
    writeFileSync(dst,upgraded);bytes=upgraded;
   }
   inventory.push({path:item.path,bytes:bytes.length,sha256:sha256(bytes)});
  }
  for(const [path,contents] of Object.entries(EXTRAS)){
   assert(!inventory.some(x=>x.path===path),'staging addition collides with source: '+path);
   const bytes=Buffer.from(contents);
   writeFileSync(join(publicDir,path),bytes,{flag:'wx'});
   inventory.push({path,bytes:bytes.length,sha256:sha256(bytes)});
  }
  inventory.sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  const actual=[];
  function walk(d,prefix=''){
   for(const name of readdirSync(d)){
    const rel=prefix?prefix+'/'+name:name,stat=lstatSync(join(d,name));
    assert(!stat.isSymbolicLink(),'symlink in output');
    if(stat.isDirectory())walk(join(d,name),rel);else {assert(stat.isFile(),'non-file in output');actual.push(rel);}
   }
  }
  walk(publicDir);
  assert(actual.length===inventory.length&&actual.every(x=>inventory.some(y=>y.path===x)),'staging file list mismatch');
  for(const item of inventory){const bytes=readFileSync(join(publicDir,item.path));assert(bytes.length===item.bytes&&sha256(bytes)===item.sha256,'output hash mismatch '+item.path);}
  const stagedHtml=readFileSync(join(publicDir,'index.html'),'utf8');
  assert(stagedHtml.includes('<meta name="robots" content="noindex,nofollow">')&&stagedHtml.includes('rel="canonical" href="'+BASE_ORIGIN+'"'),'staging robots/canonical gate');
  const stagedMerchant=readFileSync(join(publicDir,'comercios.html'),'utf8');
  assert(stagedMerchant.includes('name="robots" content="noindex,nofollow"')&&stagedMerchant.includes('rel="canonical" href="https://desset.lat/comercios"'),'Merchant page canonical or indexing gate');
  const stagedRider=readFileSync(join(publicDir,'repartidores.html'),'utf8');
  assert(stagedRider.includes('name="robots" content="noindex,nofollow"')&&stagedRider.includes('rel="canonical" href="https://desset.lat/repartidores"'),'Rider page canonical or indexing gate');
  const stagedCompany=readFileSync(join(publicDir,'empresa.html'),'utf8');
  assert(stagedCompany.includes('name="robots" content="noindex,nofollow"')&&stagedCompany.includes('rel="canonical" href="https://desset.lat/empresa"'),'Company page canonical or indexing gate');
  const robots=readFileSync(join(publicDir,'robots.txt'),'utf8');
  assert(robots==='User-agent: *\nDisallow: /\n','staging indexing guard changed');
  const report={schema:'desset-prime-native-hosting-rehearsal-v1',source_repo:'M0-coder/DESSET-prime',source_sha:sourceSha,
   source_manifest_sha256:manifestSha256,original_files:manifest.files.length,staged_files:inventory.length,
   original_total_bytes:manifest.totalBytes,staged_total_bytes:inventory.reduce((a,x)=>a+x.bytes,0),
   domain_for_canonical:'https://desset.lat/',noindex:true,robots_disallow_all:true,sitemap_has_urls:false,
   release_authorized:false,release_decision:'NO-GO',assets:inventory,
   limitations:['No GitHub/Cloudflare provenance verified by this local script','Production publication and SEO indexation require separate approval','Source files are not signed']};
  writeFileSync(join(staging,'audit.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
  return {staging,publicDir,report};
 }catch(e){if(staging)rmSync(staging,{recursive:true,force:true});throw e;}
}
if(process.argv[1]&&resolve(process.argv[1])===self){
 try{
  assert(process.argv[2]&&process.argv[3],'usage: DESSET_PRIME_HOSTING_MODE=LOCAL_REHEARSAL_ONLY node scripts/prime-hosting-candidate.mjs /absolute/path/dist EXACT_SOURCE_SHA');
  const out=preparePrimeHosting({dist:process.argv[2],sourceSha:process.argv[3],mode:process.env.DESSET_PRIME_HOSTING_MODE});
  console.log(JSON.stringify({staging:out.staging,publicDir:out.publicDir,files:out.report.staged_files,bytes:out.report.staged_total_bytes,release_decision:out.report.release_decision,release_authorized:false},null,2));
 }catch(e){console.error(e.message);process.exitCode=1;}
}
