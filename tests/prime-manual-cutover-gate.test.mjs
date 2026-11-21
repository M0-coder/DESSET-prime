import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {CONFIRM,validateReleaseIntent,validateCloudflareSnapshot} from '../scripts/prime-manual-cutover-gate.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const target=JSON.parse(readFileSync(root+'/config/prime-release-target.json','utf8'));
const sha='a'.repeat(40);
const valid={repository:'M0-coder/DESSET-prime',ref:'refs/heads/main',event:'workflow_dispatch',
 expectedSha:sha,checkoutSha:sha,previousId:target.recovery_deployment_id,confirm:CONFIRM,
 seoPolicy:'NOINDEX',target,flags:{enabled:'true',visualApprovedSha:sha,rightsApproved:'true',
  contactApproved:'true',securityApproved:'true',rollbackBackupApproved:'true',indexApproved:'false'}};
const project={success:true,result:{name:'desset-institucional',production_branch:'release-approved',
 canonical_deployment:{id:target.recovery_deployment_id,environment:'production',latest_stage:{status:'success'},
  uses_functions:false,deployment_trigger:{type:'ad_hoc',metadata:{commit_dirty:false}}}}};
const domains={success:true,result:[{name:'desset.lat',status:'active'},{name:'www.desset.lat',status:'active'}]};
const account='a'.repeat(32),p={projectResponse:project,domainsResponse:domains,previousId:target.recovery_deployment_id,expectedAccount:account,actualAccount:account};
test('fully explicit manual intent is only ready for fresh live verification',()=>{
 const r=validateReleaseIntent(valid);
 assert.equal(r.result,'READY-FOR-LIVE-PREFLIGHT',JSON.stringify(r.failures));
 assert.equal(r.release_authorized,false);assert.equal(r.requires_fresh_cloudflare_check,true);
});
test('PR and push events always fail closed',()=>{
 for(const event of ['pull_request','push','schedule'])assert.equal(validateReleaseIntent({...valid,event}).result,'NO-GO');
 assert.equal(validateReleaseIntent({...valid,ref:'refs/heads/feature'}).result,'NO-GO');
});
test('SHA, confirmation and expected rollback ID are mandatory',()=>{
 for(const opts of [{checkoutSha:'b'.repeat(40)},{expectedSha:'b'.repeat(40)},{confirm:'PUBLICAR_DESSET'}, {previousId:'b'.repeat(8)+'-0000-0000-0000-000000000000'}])
  assert.equal(validateReleaseIntent({...valid,...opts}).result,'NO-GO');
});
test('feature flag and signed visual exact SHA are mandatory',()=>{
 assert.equal(validateReleaseIntent({...valid,flags:{...valid.flags,enabled:'false'}}).result,'NO-GO');
 assert.equal(validateReleaseIntent({...valid,flags:{...valid.flags,visualApprovedSha:'b'.repeat(40)}}).result,'NO-GO');
});
test('business, contact and technical acceptance flags cannot be skipped',()=>{
 for(const name of ['rightsApproved','contactApproved','securityApproved','rollbackBackupApproved'])assert.equal(validateReleaseIntent({...valid,flags:{...valid.flags,[name]:'false'}}).result,'NO-GO');
});
test('indexing explicitly needs a further independent approval',()=>{
 assert.equal(validateReleaseIntent({...valid,seoPolicy:'INDEX'}).result,'NO-GO');
 {const r=validateReleaseIntent({...valid,seoPolicy:'INDEX',flags:{...valid.flags,indexApproved:'true'}});assert.equal(r.result,'READY-FOR-LIVE-PREFLIGHT',JSON.stringify(r.failures));}
 assert.equal(validateReleaseIntent({...valid,seoPolicy:'invalid'}).result,'NO-GO');
});
test('old-repo or modified release target fail closed',()=>{
 assert.equal(validateReleaseIntent({...valid,repository:'M0-coder/DESSET'}).result,'NO-GO');
 assert.equal(validateReleaseIntent({...valid,target:{...target,cloudflare_project:'other'}}).result,'NO-GO');
 assert.equal(validateReleaseIntent({...valid,target:{...target,production_deploy_enabled:true}}).result,'NO-GO');
});
test('realistic healthy Cloudflare snapshot passes only after authenticated GET',()=>{
 const r=validateCloudflareSnapshot(p);assert.equal(r.result,'READY-FOR-MANUAL-DEPLOY',JSON.stringify(r.failures));
 assert.equal(r.previous_deployment_id,target.recovery_deployment_id);
});
test('changed live deployment, wrong branch and dirty commit fail',()=>{
 assert.equal(validateCloudflareSnapshot({...p,projectResponse:{result:{...project.result,canonical_deployment:{...project.result.canonical_deployment,id:'b'.repeat(8)+'-0000-0000-0000-000000000000'}}}}).result,'NO-GO');
 assert.equal(validateCloudflareSnapshot({...p,projectResponse:{result:{...project.result,production_branch:'main'}}}).result,'NO-GO');
 assert.equal(validateCloudflareSnapshot({...p,projectResponse:{result:{...project.result,canonical_deployment:{...project.result.canonical_deployment,deployment_trigger:{type:'ad_hoc',metadata:{commit_dirty:true}}}}}}).result,'NO-GO');
});
test('inactive domain, functions, bad account or API errors fail',()=>{
 assert.equal(validateCloudflareSnapshot({...p,domainsResponse:{result:[domains.result[0],{name:'www.desset.lat',status:'pending'}]}}).result,'NO-GO');
 assert.equal(validateCloudflareSnapshot({...p,projectResponse:{result:{...project.result,canonical_deployment:{...project.result.canonical_deployment,uses_functions:true}}}}).result,'NO-GO');
 assert.equal(validateCloudflareSnapshot({...p,actualAccount:'b'.repeat(32)}).result,'NO-GO');
 assert.equal(validateCloudflareSnapshot({...p,projectResponse:{success:false,result:project.result}}).result,'NO-GO');
});

test('latest preview cannot replace the canonical production identity',()=>{
 const preview={id:'bbbbbbbb-0000-0000-0000-000000000000',environment:'preview',latest_stage:{status:'success'}};
 const withPreview={...project.result,latest_deployment:preview};
 assert.equal(validateCloudflareSnapshot({...p,projectResponse:{success:true,result:withPreview}}).result,'READY-FOR-MANUAL-DEPLOY');
 const changed={...withPreview,canonical_deployment:{...project.result.canonical_deployment,id:preview.id},latest_deployment:project.result.canonical_deployment};
 assert.equal(validateCloudflareSnapshot({...p,projectResponse:{success:true,result:changed}}).result,'NO-GO');
 const missing={...project.result,canonical_deployment:undefined,latest_deployment:project.result.canonical_deployment};
 assert.equal(validateCloudflareSnapshot({...p,projectResponse:{success:true,result:missing}}).result,'NO-GO');
});
