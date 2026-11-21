import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,writeFileSync,readFileSync,rmSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareReleaseEvidence} from '../scripts/prime-release-preflight.mjs';
import {verifyPrimeReleaseEvidence} from '../scripts/verify-prime-release-evidence.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const SHA='fcac31dafa51c80b6d03ab8569cb7cef211c3719';
const target=JSON.parse(readFileSync(join(root,'config/prime-release-target.json'),'utf8'));
function fixture(t){
 const p=mkdtempSync(join(tmpdir(),'prime-independent-audit-'));t.after(()=>rmSync(p,{recursive:true,force:true}));
 const publicDir=join(p,'site'), evidenceDir=join(p,'proof');
 prepareReleaseEvidence({dist:join(root,'dist'),sourceSha:SHA,gitSha:SHA,previousDeploymentId:target.recovery_deployment_id,target,artifactDir:publicDir,evidenceDir});
 return {publicDir,evidencePath:join(evidenceDir,'prime-release-evidence.json')};
}
test('independent verifier checks all 34 original/rehearsal resource hashes',t=>{
 const f=fixture(t),r=verifyPrimeReleaseEvidence({...f,expectedSha:SHA});
 assert.equal(r.result,'PASS');assert.equal(r.files,34);assert.equal(r.release_authorized,false);
});
test('rejects tampered publication bytes',t=>{
 const f=fixture(t);writeFileSync(join(f.publicDir,'assets/scene-move.webp'),'corrupt');
 assert.throws(()=>verifyPrimeReleaseEvidence({...f,expectedSha:SHA}),/NO-GO/);
});
test('rejects extra unlisted web files',t=>{
 const f=fixture(t);writeFileSync(join(f.publicDir,'unlisted.js'),'x');
 assert.throws(()=>verifyPrimeReleaseEvidence({...f,expectedSha:SHA}),/NO-GO/);
});
test('rejects altered SHA and fraudulent publication approval',t=>{
 const f=fixture(t),original=JSON.parse(readFileSync(f.evidencePath,'utf8'));
 assert.throws(()=>verifyPrimeReleaseEvidence({...f,expectedSha:'0'.repeat(40)}),/NO-GO/);
 original.release_authorized=true;writeFileSync(f.evidencePath,JSON.stringify(original));
 assert.throws(()=>verifyPrimeReleaseEvidence({...f,expectedSha:SHA}),/NO-GO/);
});
test('rejects symbolic links',t=>{
 const f=fixture(t);symlinkSync(join(f.publicDir,'index.html'),join(f.publicDir,'linked.html'));
 assert.throws(()=>verifyPrimeReleaseEvidence({...f,expectedSha:SHA}),/NO-GO/);
});
