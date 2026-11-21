import {spawnSync} from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
 for(const platform of ['Instagram','Facebook','TikTok','YouTube','X'])assert.ok(nav.includes('>'+platform+' <span'),platform);
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
