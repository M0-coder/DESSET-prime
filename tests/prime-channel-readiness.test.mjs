import {spawnSync} from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectInstitutionalChannels} from '../scripts/prime-channel-readiness.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const html=readFileSync(join(root,'index.html'),'utf8');
const state=readFileSync(join(root,'scripts/service-state.js'),'utf8');
const owner=JSON.parse(readFileSync(join(root,'config/prime-social-owner-attestation.json'),'utf8'));
const deep=x=>JSON.parse(JSON.stringify(x));
test('Five owner-declared DESSET social accounts carry owner attestation without fake platform verification',()=>{
 const r=inspectInstitutionalChannels({html,serviceState:state});
 assert.equal(r.unconfirmed_count,0);
 assert.equal(r.owner_attested_count,5);
 assert.equal(r.channels_status,'OWNER_ATTESTED');
 assert.equal(r.real_world_account_ownership_verified,false);
 assert.equal(r.technical_platform_admin_access_tested,false);
 assert.equal(r.application_distribution,'not_published');
 assert.equal(r.web_payments,false);
 assert.equal(r.release_authorized,false);
 assert.deepEqual(r.external_links.map(x=>x.href).sort(),
  owner.exact_channels.map(x=>x.url).sort());
});
test('Extra unclassified external URL is NOT automatically official',()=>{
 const modified=html.replace('</body>','<a href="https://example.org/">unknown</a></body>');
 const r=inspectInstitutionalChannels({html:modified,serviceState:state});
 assert.equal(r.unconfirmed_count,1);
 assert.equal(r.owner_attested_count,5);
 assert.equal(r.channels_status,'PENDING');
});
test('Changing a reviewed URL to an unapproved destination fails closed',()=>{
 const changed=html.replace('https://x.com/deliver_assets','https://x.com/attacker_example');
 assert.throws(()=>inspectInstitutionalChannels({html:changed,serviceState:state}),/NO-GO/);
});
test('Marking an unreviewed profile as owner-attested without a registry entry fails',()=>{
 const changed=html.replace('</body>',
  '<a href="https://example.org/" data-channel-review="owner-attested" data-channel-basis="owner-attested">X</a></body>');
 assert.throws(()=>inspectInstitutionalChannels({html:changed,serviceState:state}),/NO-GO/);
});
test('False claim that platform admin access was technically checked is rejected',()=>{
 const changed=deep(owner);changed.assertion.technical_platform_admin_access_tested=true;
 assert.throws(()=>inspectInstitutionalChannels({html,serviceState:state,attestation:changed}),/NO-GO/);
});
test('Missing provenance basis is not considered owner confirmation',()=>{
 const changed=html.replace('data-channel-review="owner-attested" data-channel-basis="owner-attested"',
  'data-channel-review="verified"');
 assert.throws(()=>inspectInstitutionalChannels({html:changed,serviceState:state}),/NO-GO/);
});
test('A channel deliberately downgraded to pending remains a launch blocker',()=>{
 const changed=html.replace('data-channel-review="owner-attested" data-channel-basis="owner-attested"',
  'data-channel-review="pending"');
 const r=inspectInstitutionalChannels({html:changed,serviceState:state});
 assert.equal(r.unconfirmed_count,1);
 assert.equal(r.channels_status,'PENDING');
});
test('TikTok and YouTube are each included once in the same accessible five-link nav',()=>{
 const nav=html.match(/<nav class="social-links social-links--official" aria-label="Redes sociales de DESSET">([\s\S]*?)<\/nav>/)?.[1];
 assert.ok(nav);
 assert.equal((nav.match(/<a\b/g)||[]).length,5);
 for(const platform of ['Instagram','Facebook','TikTok','YouTube','X'])assert.ok(nav.includes('>'+platform+'</a>'),platform);
 for(const platform of ['TikTok','YouTube'])assert.ok(owner.exact_channels.some(c=>c.platform===platform));
});
test('Spoofed TikTok hostname is rejected even if forged in the registry and HTML',()=>{
 const reg=deep(owner);
 reg.exact_channels.find(c=>c.platform==='TikTok').url='https://www.tiktok.com.evil.example/@deliver_assets';
 const forged=html.replace('https://www.tiktok.com/@deliver_assets','https://www.tiktok.com.evil.example/@deliver_assets');
 assert.throws(()=>inspectInstitutionalChannels({html:forged,serviceState:state,attestation:reg}),/NO-GO/);
});
test('A changed registry address is not silently accepted',()=>{
 const changed=deep(owner);
 changed.exact_channels[0].url='https://www.instagram.com/example_other/';
 assert.throws(()=>inspectInstitutionalChannels({html,serviceState:state,attestation:changed}),/NO-GO/);
});
test('Fraudulent claim that DESSET applications are public fails',()=>{
 assert.throws(()=>inspectInstitutionalChannels({html,
  serviceState:state.replace('applicationDistribution:"not_published"','applicationDistribution:"published"')}),/NO-GO/);
});
test('Unapproved payment form fails closed',()=>{
 assert.throws(()=>inspectInstitutionalChannels({html:html.replace('</body>','<form><input></form></body>'),
  serviceState:state}),/NO-GO/);
});
test('External HTTP URLs cannot be official',()=>{
 const changed=html.replace('https://www.instagram.com/deliver_assets/','http://www.instagram.com/deliver_assets/');
 assert.throws(()=>inspectInstitutionalChannels({html:changed,serviceState:state}),/NO-GO/);
});
test('Outbound third-party tabs keep safe rel attributes',()=>{
 const changed=html.replace('rel="noopener noreferrer" data-channel-review="owner-attested"',
   'rel="" data-channel-review="owner-attested"');
 assert.throws(()=>inspectInstitutionalChannels({html:changed,serviceState:state}),/NO-GO/);
});

test('Manual production gate cannot treat owner attestation as independent platform verification',()=>{
 const out=spawnSync(process.execPath,[join(root,'scripts/prime-channel-readiness.mjs'),
  join(root,'index.html'),join(root,'scripts/service-state.js'),'','--require-verified'],
  {encoding:'utf8'});
 assert.equal(out.status,2,'manual release must fail closed until independent proof exists');
 assert.match(out.stderr,/independent platform ownership verification is required/);
});

test('protected release CLI binds private review to the exact release and each declared profile',()=>{
 const sha='1'.repeat(40);
 const review={schema:'desset-prime-channel-admin-review-v1',repository:'M0-coder/DESSET-prime',
  source_sha:sha,reviewer:'test reviewer',reviewed_at:'2020-01-01T00:00:00Z',
  channels:owner.exact_channels.map(({platform,url})=>({platform,url,
   method:'authenticated-admin-control-observed',evidence_sha256:'a'.repeat(64)}))};
 const run=(value,mode='--require-verified')=>spawnSync(process.execPath,
  [join(root,'scripts/prime-channel-readiness.mjs'),join(root,'index.html'),
   join(root,'scripts/service-state.js'),'',...(mode?[mode]:[])],
  {encoding:'utf8',env:{...process.env,GITHUB_SHA:sha,DESSET_CHANNEL_ADMIN_REVIEW:JSON.stringify(value)}});
 const pass=run(review);
 assert.equal(pass.status,0,pass.stderr);
 assert.equal(JSON.parse(pass.stdout).channels_status,'ADMIN_REVIEW_VERIFIED');
 assert.equal(JSON.parse(pass.stdout).release_authorized,false);
 assert.equal(JSON.parse(run(review,'').stdout).technical_platform_admin_access_tested,false);
 for(const change of [
  r=>{r.source_sha='2'.repeat(40)},r=>{r.repository='other/repo'},r=>{r.channels.pop()},
  r=>{r.channels[0]=r.channels[1]},r=>{r.channels[0].url+='other'},
  r=>{r.channels[0].evidence_sha256=''},r=>{r.channels[0].method='owner-attested'},
  r=>{r.reviewed_at='invalid'},r=>{r.reviewer=''}
 ]){
  const changed=deep(review);change(changed);assert.equal(run(changed).status,2);
 }
 assert.equal(run(review,'--require-verifed').status,2);
});

test('release accepts exact owner-declared links without claiming admin access or granting publication',()=>{
 const sha='a'.repeat(40);
 const check=(overrides={},source=join(root,'index.html'))=>spawnSync(process.execPath,[
  join(root,'scripts/prime-channel-readiness.mjs'),source,join(root,'scripts/service-state.js'),
  '','--accept-owner-declaration'],{encoding:'utf8',env:{...process.env,
   RELEASE_SHA:sha,GITHUB_SHA:sha,...overrides}});
 const ok=check();
 assert.equal(ok.status,0,ok.stderr);
 const report=JSON.parse(ok.stdout);
 assert.equal(report.channels_status,'OWNER_ATTESTED');
 assert.equal(report.technical_platform_admin_access_tested,false);
 assert.equal(report.release_authorized,false);
 for(const env of [{GITHUB_SHA:'b'.repeat(40)},{RELEASE_SHA:'b'.repeat(40)},{RELEASE_SHA:''}]){
  assert.equal(check(env).status,2);
 }
 const directory=mkdtempSync(join(tmpdir(),'desset-channel-test-'));
 try{
  const unknown=join(directory,'index.html');
  writeFileSync(unknown,html.replace('</body>','<a href="https://example.org/">otro</a></body>'));
  assert.equal(check({},unknown).status,2);
 }finally{rmSync(directory,{recursive:true,force:true});}
});
