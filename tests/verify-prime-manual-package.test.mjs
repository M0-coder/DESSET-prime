import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {preparePrimeCutoverPackage} from '../scripts/prime-manual-cutover-package.mjs';
import {verifyManualPackage} from '../scripts/verify-prime-manual-package.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dist=join(root,'dist');
const SHA='fcac31dafa51c80b6d03ab8569cb7cef211c3719';
function fixture(t,seo='NOINDEX'){
 const p=mkdtempSync(join(tmpdir(),'prime-manual-verify-'));t.after(()=>rmSync(p,{recursive:true,force:true}));
 const publicDir=join(p,'site'),proof=join(p,'proof');
 preparePrimeCutoverPackage({dist,sourceSha:SHA,seoPolicy:seo,outputDir:publicDir,evidenceDir:proof});
 return {publicDir,reportPath:join(proof,'prime-manual-release-package.json'),sourceSha:SHA,seoPolicy:seo};
}
test('manual NOINDEX package validates independently for each file',t=>{
 const f=fixture(t);const r=verifyManualPackage(f);
 assert.equal(r.result,'PASS');assert.equal(r.files,70);assert.equal(r.production_deployed,false);
});
test('explicit INDEX package validates independently for each file',t=>{
 const f=fixture(t,'INDEX');assert.equal(verifyManualPackage(f).result,'PASS');
});
test('a tampered photograph invalidates release bytes',t=>{
 const f=fixture(t);writeFileSync(join(f.publicDir,'assets/scene-prepare.webp'),'changed');
 assert.throws(()=>verifyManualPackage(f),/NO-GO/);
});
test('a modified report SHA cannot approve another commit',t=>{
 const f=fixture(t);assert.throws(()=>verifyManualPackage({...f,sourceSha:'b'.repeat(40)}),/NO-GO/);
});
test('different policy blocks wrong SEO',t=>{
 const f=fixture(t);assert.throws(()=>verifyManualPackage({...f,seoPolicy:'INDEX'}),/NO-GO/);
});
test('a falsified production authorization in audit is rejected',t=>{
 const f=fixture(t);const r=JSON.parse(readFileSync(f.reportPath,'utf8'));r.production_authorized=true;
 writeFileSync(f.reportPath,JSON.stringify(r));
 assert.throws(()=>verifyManualPackage(f),/NO-GO/);
});

test('removing complete MIT notice prevents release',t=>{
 const f=fixture(t);
 writeFileSync(join(f.publicDir,'THIRD-PARTY-NOTICES.txt'),'missing terms');
 assert.throws(()=>verifyManualPackage(f),/NO-GO/);
});
test('tampered MIT license evidence cannot pass independently',t=>{
 const f=fixture(t);
 const report=JSON.parse(readFileSync(f.reportPath,'utf8'));
 report.third_party_notice_sha256='0'.repeat(64);
 writeFileSync(f.reportPath,JSON.stringify(report));
 assert.throws(()=>verifyManualPackage(f),/NO-GO/);
});
