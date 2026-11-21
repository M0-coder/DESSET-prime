import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {inspectInstitutionalChannels} from '../scripts/prime-channel-readiness.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const html=readFileSync(join(root,'index.html'),'utf8');
const state=readFileSync(join(root,'scripts/service-state.js'),'utf8');
test('real Prime: three external social profiles remain pending, no fake orders/apps',()=>{
 const r=inspectInstitutionalChannels({html,serviceState:state});
 assert.equal(r.unconfirmed_count,3);
 assert.equal(r.channels_status,'PENDING');
 assert.equal(r.application_distribution,'not_published');
 assert.equal(r.web_payments,false);
 assert.equal(r.release_authorized,false);
});
test('source-reviewed profiles remove the pending gate without falsely claiming real-world verification',()=>{
 const copy=html.replaceAll('data-channel-review="pending"','data-channel-review="verified"');
 const r=inspectInstitutionalChannels({html:copy,serviceState:state});
 assert.equal(r.unconfirmed_count,0);
 assert.equal(r.channels_status,'VERIFIED_IN_SOURCE');
 assert.equal(r.real_world_account_ownership_verified,false);
});
test('adding an unclassified external channel never becomes approved by accident',()=>{
 const copy=html.replace('</body>','<a href="https://example.org/">unknown</a></body>');
 const r=inspectInstitutionalChannels({html:copy,serviceState:state});
 assert.equal(r.unconfirmed_count,4);
});
test('fraudulent public app status fails',()=>{
 assert.throws(()=>inspectInstitutionalChannels({html,serviceState:state.replace('applicationDistribution:"not_published"','applicationDistribution:"published"')}),/NO-GO/);
});
test('unapproved payment form fails closed',()=>{
 assert.throws(()=>inspectInstitutionalChannels({html:html.replace('</body>','<form><input></form></body>'),serviceState:state}),/NO-GO/);
});
test('external HTTP destinations are rejected',()=>{
 const altered=html.replace('https://www.instagram.com/deliver_assets/','http://www.instagram.com/deliver_assets/');
 assert.throws(()=>inspectInstitutionalChannels({html:altered,serviceState:state}),/NO-GO/);
});
test('outbound links opening a new tab must be sandboxed against opener attacks',()=>{
 const altered=html.replace('rel="noopener noreferrer" data-channel-review="pending"','rel="" data-channel-review="pending"');
 assert.throws(()=>inspectInstitutionalChannels({html:altered,serviceState:state}),/NO-GO/);
});
