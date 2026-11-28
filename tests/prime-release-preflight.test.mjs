import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,cpSync,rmSync,writeFileSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {evaluateReleaseControls,prepareReleaseEvidence} from '../scripts/prime-release-preflight.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const realDist=join(root,'dist');
const target=JSON.parse(readFileSync(join(root,'config/prime-release-target.json'),'utf8'));
const SHA='fcac31dafa51c80b6d03ab8569cb7cef211c3719';
const prev=target.recovery_deployment_id;
const opts={dist:realDist,sourceSha:SHA,gitSha:SHA,previousDeploymentId:prev,target};
function temp(t){const x=mkdtempSync(join(tmpdir(),'prime-release-test-'));t.after(()=>rmSync(x,{recursive:true,force:true}));return x;}
function copiedDist(t){const p=temp(t),dist=join(p,'dist');cpSync(realDist,dist,{recursive:true});return dist;}
test('exact Prime commit and Cloudflare recovery preflight PASS but publication NO-GO',()=>{
 const r=evaluateReleaseControls({sourceSha:SHA,actualGitSha:SHA,previousDeploymentId:prev,target});
 assert.equal(r.integrity_controls,'PASS');assert.equal(r.release_authorized,false);assert.equal(r.release_decision,'NO-GO');
});
test('two independently created staging packages match file-by-file; evidence stays out of public root',t=>{
 const parent=temp(t),evidenceDir=join(parent,'evidence'),artifactDir=join(parent,'prepared-public');const report=prepareReleaseEvidence({...opts,evidenceDir,artifactDir});
 assert.equal(report.repeated_packaging_identical,true);
 assert.equal(report.independently_compiled_twice,false);
 assert.equal(report.original_files,89);assert.equal(report.staged_files,92);
 assert.equal(report.release_authorized,false);assert.equal(report.release_decision,'NO-GO');
 assert.ok(!report.publication_checks_pending.includes(''));
 assert.deepEqual(JSON.parse(readFileSync(join(evidenceDir,'prime-release-evidence.json'),'utf8')),report);
 assert.match(readFileSync(join(artifactDir,'robots.txt'),'utf8'),/Disallow: \/$/m);
 assert.equal(report.files.length,92);
 assert.ok(report.files.every(x=>/^[a-f0-9]{64}$/.test(x.sha256))); 
 assert.deepEqual(readFileSync(join(artifactDir,'assets/scene-move.webp')),readFileSync(join(realDist,'assets/scene-move.webp')));
});
test('different checkout Git SHA is a hard failure',()=>{
 assert.throws(()=>prepareReleaseEvidence({...opts,gitSha:'a'.repeat(40)}),/NO-GO/);
});
test('historical deployment ID must match exactly; new deployment requires renewed review',()=>{
 assert.throws(()=>prepareReleaseEvidence({...opts,previousDeploymentId:'b0000000-0000-0000-0000-000000000001'}),/NO-GO/);
});
test('wrong Pages project never passes even if source is valid',()=>{
 assert.throws(()=>prepareReleaseEvidence({...opts,target:{...target,cloudflare_project:'another-project'}}),/NO-GO/);
});
test('cannot mark production approved through policy file',()=>{
 assert.throws(()=>prepareReleaseEvidence({...opts,target:{...target,production_deploy_enabled:true}}),/NO-GO/);
});
test('rights approval policy cannot be silently removed',()=>{
 assert.throws(()=>prepareReleaseEvidence({...opts,target:{...target,requires_fresh_owner_approval:false}}),/NO-GO/);
});
test('binary tampering is rejected before making release evidence',t=>{
 const dist=copiedDist(t);writeFileSync(join(dist,'assets/scene-move.webp'),'tampered');
 assert.throws(()=>prepareReleaseEvidence({...opts,dist}),/NO-GO/);
});
test('unexpected files are rejected before release evidence',t=>{
 const dist=copiedDist(t);writeFileSync(join(dist,'assets/rogue.js'),'malicious');
 assert.throws(()=>prepareReleaseEvidence({...opts,dist}),/NO-GO/);
});
test('presence of Cloudflare token blocks read-only preparation',()=>{
 const old=process.env.CF_API_TOKEN;
 try {process.env.CF_API_TOKEN='fixture';assert.throws(()=>prepareReleaseEvidence(opts),/NO-GO/)}
 finally {if(old===undefined)delete process.env.CF_API_TOKEN;else process.env.CF_API_TOKEN=old;}
});
test('missing exact commit is rejected',()=>{
 assert.throws(()=>prepareReleaseEvidence({...opts,sourceSha:''}),/NO-GO/);
});

test('cannot overwrite an existing candidate path',t=>{
 const evidenceDir=temp(t);
 assert.throws(()=>prepareReleaseEvidence({...opts,artifactDir:evidenceDir}),/NO-GO/);
});

test('report cannot be written inside public candidate',t=>{
 const parent=temp(t),artifactDir=join(parent,'candidate'),evidenceDir=join(artifactDir,'evidence');
 assert.throws(()=>prepareReleaseEvidence({...opts,artifactDir,evidenceDir}),/NO-GO/);
});
