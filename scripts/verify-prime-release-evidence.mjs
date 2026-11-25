/** Offline independent verifier for the extracted, NOT-authorized Prime candidate. */
import {readFileSync,readdirSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
const sha = b => createHash('sha256').update(b).digest('hex');
const fail = message=>{throw new Error('NO-GO: '+message)};
const check = (cond,msg)=>{if(!cond)fail(msg)};
function safeName(p){return typeof p==='string'&&(/^[a-z0-9_.\/-]+$/.test(p)||/^fonts\/LICENSE-(?:Inter|Plus-Jakarta-Sans)-OFL\.txt$/.test(p))&&!p.startsWith('/')&&!p.split('/').some(x=>!x||x==='.'||x==='..');}
export function verifyPrimeReleaseEvidence({publicDir,evidencePath,expectedSha}) {
 check(isAbsolute(publicDir)&&isAbsolute(evidencePath),'absolute paths required');
 const info=JSON.parse(readFileSync(evidencePath,'utf8'));
 check(info.schema==='desset-prime-release-evidence-v1'&&info.origin_repository==='M0-coder/DESSET-prime','invalid release provenance');
 check(/^[a-f0-9]{40}$/.test(expectedSha)&&info.origin_sha===expectedSha&&info.checkout_sha===expectedSha,'SHA mismatch');
 check(info.release_authorized===false&&info.release_decision==='NO-GO','not an offline-only candidate');
 check(info.noindex===true&&info.robots_disallow_all===true,'indexing policy changed');
 check(info.original_files===56&&info.staged_files===59,'package shape mismatch');
 check(info.repeated_packaging_identical===true&&info.independently_compiled_twice===false,'evidence claims changed');
 check(Array.isArray(info.files)&&info.files.length===59,'missing per-asset manifest');
 check(sha(Buffer.from(JSON.stringify(info.files)))===info.artifacts_sha256,'manifest checksum mismatch');
 const expected=new Map(),actual=new Set();let total=0;
 for(const f of info.files){
   check(safeName(f.path)&&!expected.has(f.path),'unsafe or duplicate path');
   check(Number.isSafeInteger(f.bytes)&&f.bytes>0&&/^[a-f0-9]{64}$/.test(f.sha256),'bad asset descriptor');
   expected.set(f.path,f);total+=f.bytes;
 }
 check(total===info.staged_total_bytes,'total bytes mismatch');
 function walk(dir,prefix=''){
   for(const name of readdirSync(dir)){
     const path=prefix?prefix+'/'+name:name,full=join(dir,name),stat=lstatSync(full);
     check(!stat.isSymbolicLink(),'symlink in package: '+path);
     if(stat.isDirectory())walk(full,path);
     else {check(stat.isFile()&&!actual.has(path),'nonregular/duplicate path: '+path);actual.add(path);}
   }
 }
 walk(publicDir);
 check(actual.size===expected.size,'unexpected file count');
 for(const path of actual)check(expected.has(path),'unlisted package file: '+path);
 for(const [path,f] of expected){
   check(actual.has(path),'missing file: '+path);
   const bytes=readFileSync(join(publicDir,path));
   check(bytes.length===f.bytes&&sha(bytes)===f.sha256,'corrupted package resource: '+path);
 }
 check(!expected.has('site-manifest.json')&&!expected.has('prime-release-evidence.json'),'internal proof exposed as web asset');
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
 const news=readFileSync(join(publicDir,'noticias.html'),'utf8');
 check(news.includes('name="robots" content="noindex,nofollow"')&&news.includes('rel="canonical" href="https://desset.lat/noticias"'),'News page canonical or noindex changed');
 const careers=readFileSync(join(publicDir,'talento.html'),'utf8');
 check(careers.includes('name="robots" content="noindex,nofollow"')&&careers.includes('rel="canonical" href="https://desset.lat/talento"'),'Careers page canonical or noindex changed');
 const english=readFileSync(join(publicDir,'en.html'),'utf8');
 check(english.includes('name="robots" content="noindex,nofollow"')&&english.includes('rel="canonical" href="https://desset.lat/en"'),'English page canonical or noindex changed');
 const company=readFileSync(join(publicDir,'empresa.html'),'utf8');
 check(company.includes('name="robots" content="noindex,nofollow"')&&company.includes('rel="canonical" href="https://desset.lat/empresa"'),'Company page canonical or noindex changed');
 const robots=readFileSync(join(publicDir,'robots.txt'),'utf8');
 const site=readFileSync(join(publicDir,'sitemap.xml'),'utf8');
 check(html.includes('name="robots" content="noindex,nofollow"')&&robots==='User-agent: *\nDisallow: /\n','dangerous indexing state');
 check(html.includes('rel="canonical" href="https://desset.lat/"')&&!site.includes('<loc>'),'release SEO gate not explicit');
 for(const part of ['proveedores','comercios','consumidores','operadores-logisticos']){const path='assets/ecosistema-'+part+'.webp';check(html.includes('./'+path)&&expected.has(path),'participant asset missing: '+part);}
 check(readFileSync(join(publicDir,'scripts/service-state.js'),'utf8').includes('applicationDistribution:"not_published"'),'apps erroneously enabled');
 return {result:'PASS',origin_sha:info.origin_sha,files:expected.size,bytes:total,release_authorized:false,release_decision:'NO-GO'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
   const [publicDir,evidencePath,expectedSha]=process.argv.slice(2);
   const r=verifyPrimeReleaseEvidence({publicDir,evidencePath,expectedSha});
   console.log(JSON.stringify(r,null,2));
 }catch(e){console.error(e.message);process.exitCode=1}
}
