import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdtempSync,rmSync,cpSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkAssetRightsAndLicenses} from '../scripts/prime-rights-license-audit.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dist=join(root,'dist');
const base=JSON.parse(readFileSync(join(root,'config/prime-original-assets.json'),'utf8'));
const lock=JSON.parse(readFileSync(join(root,'package-lock.json'),'utf8'));
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
const deep=value=>JSON.parse(JSON.stringify(value));
const opts={dist,register:base,lock,pkg};
function copyDist(t){
 const temp=mkdtempSync(join(tmpdir(),'prime-asset-audit-test-'));t.after(()=>rmSync(temp,{recursive:true,force:true}));
 const copy=join(temp,'dist');cpSync(dist,copy,{recursive:true});return copy;
}
test('12 owner-declared active original media are individually SHA-256 verified',()=>{
 const r=checkAssetRightsAndLicenses(opts);
 assert.equal(r.outcome,'PASS');assert.equal(r.assets_checked,12);assert.equal(r.archived_media_checked,2);assert.ok(r.archived_media.every(a=>a.scope==='source-only'));assert.ok(!r.assets.some(a=>a.path.startsWith('assets/roles-geometry-')));
 assert.equal(r.legal_title_independently_verified,false);
 assert.equal(r.talent_media.path,'assets/talento-cultura.webp');assert.equal(r.talent_media.claim,'third-party');assert.equal(r.talent_media.individual_source_verified,false);
 assert.equal(r.prime_page_media_checked,6);assert.equal(r.prime_page_media.filter(a=>a.claim==='third-party').length,1);assert.equal(r.selected_media_checked,4);assert.equal(r.individual_license_review_complete,false);
 assert.equal(r.selected_media_review.basis,'owner-attested-free-download');
 assert.equal(r.selected_media_review.release_authorized,false);
 assert.equal(r.selected_media_owner_attestation.independent_legal_verification,false);
 assert.equal(r.selected_media.filter(a=>a.claim==="third-party").length,3);
 assert.ok(r.selected_media.every(a=>a.claim!=="owner-declared"));
 assert.equal(r.fonts_checked,2);assert.equal(r.font_license,'SIL-OFL-1.1');
 assert.equal(r.fonts_are_third_party,true);
 assert.equal(r.publication_authorized,false);assert.equal(r.release_decision,'NO-GO');
 assert.ok(r.assets.every(a=>a.claim==='owner-declared'&&a.sha256.length===64));
 assert.ok(!r.assets.some(a=>/v5-(?:cinematic|logistics)/.test(a.path)),'Orphan 2D poster must not be part of release assets');
});
test('licenses preserve the distinction between original DESSET media and third party',()=>{
 const r=checkAssetRightsAndLicenses(opts);
 assert.ok(!r.assets.some(a=>a.path==='assets/v6-three.bundle.js'));
 assert.equal(r.compiled_bundle_contains_third_party,true);
 assert.ok(r.third_party_packages.some(a=>a.name==='three'&&a.version==='0.187.0'&&a.license==='MIT'&&!a.dev));
 assert.ok(r.third_party_packages.some(a=>a.name==='esbuild'&&a.version==='0.28.2'&&a.license==='MIT'&&a.dev));
});
test('replaced photograph without revised asset register is rejected',t=>{
 const copy=copyDist(t);
 writeFileSync(join(copy,'assets/scene-move.webp'),'changed');
 assert.throws(()=>checkAssetRightsAndLicenses({...opts,dist:copy}),/NO-GO/);
});
test('falsified pinned SHA-256 is rejected',()=>{
 const changed=deep(base);changed.assets[0].sha256='f'.repeat(64);
 assert.throws(()=>checkAssetRightsAndLicenses({...opts,register:changed}),/NO-GO/);
});
test('missing original media entry is rejected',()=>{
 const changed=deep(base);changed.assets.pop();
 assert.throws(()=>checkAssetRightsAndLicenses({...opts,register:changed}),/NO-GO/);
});
test('declaration cannot be escalated to independently verified legal title',()=>{
 const changed=deep(base);changed.assertion.independent_legal_verification=true;
 assert.throws(()=>checkAssetRightsAndLicenses({...opts,register:changed}),/NO-GO/);
});
test('bundle containing third-party software must never be claimed wholly proprietary',()=>{
 const changed=deep(base);changed.excluded_generated_asset='assets/scene-choose.webp';
 assert.throws(()=>checkAssetRightsAndLicenses({...opts,register:changed}),/NO-GO/);
});
test('third-party license cannot be silently removed or made proprietary',()=>{
 const changed=deep(lock);changed.packages['node_modules/three'].license='PROPRIETARY';
 assert.throws(()=>checkAssetRightsAndLicenses({...opts,lock:changed}),/NO-GO/);
});
test('unreviewed Three.js upgrade is rejected',()=>{
 const changed=deep(pkg);changed.dependencies.three='0.188.0';
 assert.throws(()=>checkAssetRightsAndLicenses({...opts,pkg:changed}),/NO-GO/);
});
test('lockfile package integrity is mandatory',()=>{
 const changed=deep(lock);delete changed.packages['node_modules/three'].integrity;
 assert.throws(()=>checkAssetRightsAndLicenses({...opts,lock:changed}),/NO-GO/);
});

test("tampered selected photograph is rejected without claiming third-party ownership",t=>{
 const copy=copyDist(t);
 writeFileSync(join(copy,'assets/ecosistema-proveedores.webp'),'changed');
 assert.throws(()=>checkAssetRightsAndLicenses({...opts,dist:copy}),/NO-GO/);
});
