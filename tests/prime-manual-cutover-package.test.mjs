import {companyFiles} from "../scripts/company-routes.mjs";
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,cpSync,mkdtempSync,rmSync,existsSync,readdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {preparePrimeCutoverPackage} from '../scripts/prime-manual-cutover-package.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dist=join(root,'dist');
const SHA='fcac31dafa51c80b6d03ab8569cb7cef211c3719';
function fixture(t,seoPolicy='NOINDEX',src=dist){
 const parent=mkdtempSync(join(tmpdir(),'prime-publish-package-'));t.after(()=>rmSync(parent,{recursive:true,force:true}));
 const outputDir=join(parent,'site'),evidenceDir=join(parent,'evidence');
 const report=preparePrimeCutoverPackage({dist:src,sourceSha:SHA,seoPolicy,outputDir,evidenceDir});
 return {parent,outputDir,evidenceDir,report};
}
test('NOINDEX release shape preserves source and blocks crawling',t=>{
 const f=fixture(t);assert.equal(f.report.package_files,92);
 assert.equal(f.report.production_deployed,false);assert.equal(f.report.production_authorized,false);
 assert.match(readFileSync(join(f.outputDir,'index.html'),'utf8'),/name="robots" content="noindex,nofollow"/);
 assert.equal(readFileSync(join(f.outputDir,'robots.txt'),'utf8'),'User-agent: *\nDisallow: /\n');
 assert.ok(!readFileSync(join(f.outputDir,'sitemap.xml'),'utf8').includes('<loc>'));
 assert.deepEqual(JSON.parse(readFileSync(join(f.evidenceDir,'prime-manual-release-package.json'),'utf8')),f.report);
 assert.ok(!readdirSync(f.outputDir).includes('prime-manual-release-package.json'));
 assert.match(readFileSync(join(f.outputDir,'THIRD-PARTY-NOTICES.txt'),'utf8'),/three 0\.187\.0 \(MIT\)/);
 assert.match(readFileSync(join(f.outputDir,'THIRD-PARTY-NOTICES.txt'),'utf8'),/esbuild 0\.28\.2 \(MIT\)/);
 assert.match(readFileSync(join(f.outputDir,'fonts/LICENSE-Inter-OFL.txt'),'utf8'),/SIL OPEN FONT LICENSE Version 1.1/);
 assert.match(readFileSync(join(f.outputDir,'fonts/LICENSE-Plus-Jakarta-Sans-OFL.txt'),'utf8'),/SIL OPEN FONT LICENSE Version 1.1/);
});
test('INDEX release shape has explicit canonical, OG, robots and sitemap',t=>{
 const f=fixture(t,'INDEX'),html=readFileSync(join(f.outputDir,'index.html'),'utf8');
 assert.match(html,/name="robots" content="index,follow"/);
 assert.match(html,/rel="canonical" href="https:\/\/desset.lat\/"/);
 assert.match(html,/property="og:image"/);
 assert.match(html,/name="twitter:card"/);
 assert.equal(readFileSync(join(f.outputDir,'robots.txt'),'utf8'),'User-agent: *\nAllow: /\nSitemap: https://desset.lat/sitemap.xml\n');
 assert.match(readFileSync(join(f.outputDir,'sitemap.xml'),'utf8'),/<loc>https:\/\/desset.lat\/<\/loc>/);
});
test('all non-SEO brand assets and security content are original bytes',t=>{
 const f=fixture(t,'INDEX'),original=JSON.parse(readFileSync(join(dist,'site-manifest.json'),'utf8'));
 for(const item of original.files){
   if([...companyFiles,'index.html','empresa.html','comercios.html','repartidores.html','prime.html','contacto.html','confianza.html','noticias.html','talento.html','en.html','registro-comercios.html','incorporacion-comercios.html','registro-repartidores.html','incorporacion-repartidores.html','capacitacion-repartidores.html','aplicaciones.html','aplicaciones-clientes.html','aplicaciones-comercios.html','aplicaciones-repartidores.html','_headers'].includes(item.path))continue;
   assert.deepEqual(readFileSync(join(f.outputDir,item.path)),readFileSync(join(dist,item.path)),item.path);
 }
 assert.match(readFileSync(join(f.outputDir,'_headers'),'utf8'),/Content-Security-Policy/);
 assert.match(readFileSync(join(f.outputDir,'_headers'),'utf8'),/Cache-Control: no-cache, must-revalidate/);
});
test('identical independent package runs are bytewise reproducible',t=>{
 const a=fixture(t,'INDEX'),b=fixture(t,'INDEX');
 assert.deepEqual(a.report.assets,b.report.assets);
 assert.equal(a.report.assets_manifest_sha256,b.report.assets_manifest_sha256);
});
test('unrecognized or missing SEO policy fails closed',t=>{
 for(const policy of ['wrong',undefined]) {
  const parent=mkdtempSync(join(tmpdir(),'prime-invalid-seo-'));t.after(()=>rmSync(parent,{recursive:true,force:true}));
  assert.throws(()=>preparePrimeCutoverPackage({dist,sourceSha:SHA,seoPolicy:policy,outputDir:join(parent,'out'),evidenceDir:join(parent,'audit')}),/NO-GO/);
 }
});
test('cannot overwrite existing release output or write within source',t=>{
 const parent=mkdtempSync(join(tmpdir(),'prime-existing-'));t.after(()=>rmSync(parent,{recursive:true,force:true}));
 assert.throws(()=>preparePrimeCutoverPackage({dist,sourceSha:SHA,seoPolicy:'NOINDEX',outputDir:parent,evidenceDir:join(parent,'audit')}),/NO-GO/);
 assert.throws(()=>preparePrimeCutoverPackage({dist,sourceSha:SHA,seoPolicy:'NOINDEX',outputDir:join(root,'dist','unsafe'),evidenceDir:join(parent,'audit')}),/NO-GO/);
});
test('unexpected new file inside source fails before copying',t=>{
 const parent=mkdtempSync(join(tmpdir(),'prime-roque-'));t.after(()=>rmSync(parent,{recursive:true,force:true}));
 const local=join(parent,'copy');cpSync(dist,local,{recursive:true});
 writeFileSync(join(local,'unknown.txt'),'x');
 assert.throws(()=>preparePrimeCutoverPackage({dist:local,sourceSha:SHA,seoPolicy:'INDEX',outputDir:join(parent,'out'),evidenceDir:join(parent,'audit')}),/NO-GO/);
});
