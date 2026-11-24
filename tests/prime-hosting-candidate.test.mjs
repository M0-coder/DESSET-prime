import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,readFileSync,rmSync,cpSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {preparePrimeHosting} from '../scripts/prime-hosting-candidate.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const realDist=resolve(root,'dist');
const SHA='fcac31dafa51c80b6d03ab8569cb7cef211c3719';
function newDir(t){const path=mkdtempSync(join(tmpdir(),'prime-host-tests-'));t.after(()=>rmSync(path,{recursive:true,force:true}));return path;}
function realCopy(t){const d=newDir(t),copy=join(d,'dist');cpSync(realDist,copy,{recursive:true});return copy;}
function build(t,dist=realDist){const result=preparePrimeHosting({dist,sourceSha:SHA,mode:'LOCAL_REHEARSAL_ONLY'});t.after(()=>rmSync(result.staging,{recursive:true,force:true}));return result;}
test('Prime-only authentic package -> isolated staging and NO-GO',t=>{
 const stage=build(t);const source=JSON.parse(readFileSync(join(realDist,'site-manifest.json')));
 assert.equal(stage.report.original_files,source.files.length);
 assert.equal(stage.report.staged_files,source.files.length+3);
 assert.equal(stage.report.release_authorized,false);
 assert.equal(stage.report.release_decision,'NO-GO');
 assert.equal(stage.report.noindex,true);
 assert.equal(stage.report.robots_disallow_all,true);
 assert.equal(stage.report.sitemap_has_urls,false);
 assert.ok(!stage.report.assets.some(x=>x.path==='site-manifest.json'));
 assert.match(readFileSync(join(stage.publicDir,'index.html'),'utf8'),/canonical" href="https:\/\/desset.lat\/"/);
 assert.match(readFileSync(join(stage.publicDir,'robots.txt'),'utf8'),/Disallow: \/$/m);
 assert.match(readFileSync(join(stage.publicDir,'scripts/service-state.js'),'utf8'),/not_published/);
 assert.equal(readFileSync(join(stage.staging,'audit.json'),'utf8').includes('release_authorized'),true);
});
test('source asset bytes unchanged (except deliberately added HEAD metadata)',t=>{
 const stage=build(t),source=JSON.parse(readFileSync(join(realDist,'site-manifest.json')));
 for(const f of source.files){
  if(f.path==='index.html'||f.path==='empresa.html')continue;
  assert.deepEqual(readFileSync(join(stage.publicDir,f.path)),readFileSync(join(realDist,f.path)));
 }
 assert.deepEqual(readFileSync(join(stage.publicDir,'assets/deliver-assets-mark.png')),readFileSync(join(realDist,'assets/deliver-assets-mark.png')));
});
test('repeated output has byte-for-byte identical inventory',t=>{
 const a=build(t),b=build(t);assert.notEqual(a.staging,b.staging);
 assert.deepEqual(a.report.assets,b.report.assets);
 assert.equal(a.report.staged_total_bytes,b.report.staged_total_bytes);
});
test('missing local-rehearsal opt-in is blocked',()=>{
 assert.throws(()=>preparePrimeHosting({dist:realDist,sourceSha:SHA}),/NO-GO/);
});
test('wrong or absent source SHA blocked',()=>{
 assert.throws(()=>preparePrimeHosting({dist:realDist,sourceSha:'x'.repeat(40),mode:'LOCAL_REHEARSAL_ONLY'}),/NO-GO/);
 assert.throws(()=>preparePrimeHosting({dist:realDist,sourceSha:'',mode:'LOCAL_REHEARSAL_ONLY'}),/NO-GO/);
});
test('changed photo fails SHA contract',t=>{
 const dist=realCopy(t);writeFileSync(join(dist,'assets/scene-move.webp'),'mutated photograph');
 assert.throws(()=>preparePrimeHosting({dist,sourceSha:SHA,mode:'LOCAL_REHEARSAL_ONLY'}),/NO-GO/);
});
test('added file fails closed',t=>{
 const dist=realCopy(t);writeFileSync(join(dist,'unknown.js'),'unexpected');
 assert.throws(()=>preparePrimeHosting({dist,sourceSha:SHA,mode:'LOCAL_REHEARSAL_ONLY'}),/NO-GO/);
});
test('symbolic link in dist fails closed',t=>{
 const dist=realCopy(t);symlinkSync(join(dist,'index.html'),join(dist,'link.html'));
 assert.throws(()=>preparePrimeHosting({dist,sourceSha:SHA,mode:'LOCAL_REHEARSAL_ONLY'}),/NO-GO/);
});
test('changed source noindex fails closed',t=>{
 const dist=realCopy(t);const p=join(dist,'index.html');writeFileSync(p,readFileSync(p,'utf8').replace('noindex,nofollow','index,follow'));
 assert.throws(()=>preparePrimeHosting({dist,sourceSha:SHA,mode:'LOCAL_REHEARSAL_ONLY'}),/NO-GO/);
});
test('production credentials block rehearsal',()=>{
 const old=process.env.CF_API_TOKEN;
 try{process.env.CF_API_TOKEN='blocked';assert.throws(()=>preparePrimeHosting({dist:realDist,sourceSha:SHA,mode:'LOCAL_REHEARSAL_ONLY'}),/NO-GO/);}finally{if(old===undefined)delete process.env.CF_API_TOKEN;else process.env.CF_API_TOKEN=old;}
});
