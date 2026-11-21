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
  contactApproved:'true',securityApproved:'true',indexApproved:'false'}};
const project={success:true,result:{name:'desset-institucional',production_branch:'release-approved',
 latest_deployment:{id:target.recovery_deployment_id,environment:'production',latest_stage:{status:'success'},
  uses_functions:false,deployment_trigger:{type:'ad_hoc',metadata:{commit_dirty:false}}}}};
const domains={success:true,result:[{name:'desset.lat',status:'active'},{name:'www.desset.lat',status:'active'}]};
const account='a'.repeat(32),p={projectResponse:project,domainsResponse:domains,previousId:target.recovery_deployment_id,expectedAccount:account,actualAccount:account};
test('fully explicit manual intent is only ready for fresh live verification',()=>{
 const r=validateReleaseIntent(valid);
 assert.equal(r.result,'READY-FOR-LIVE-PREFLIGHT');
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
 for(const name of ['rightsApproved','contactApproved','securityApproved'])assert.equal(validateReleaseIntent({...valid,flags:{...valid.flags,[name]:'false'}}).result,'NO-GO');
});
test('indexing explicitly needs a further independent approval',()=>{
 assert.equal(validateReleaseIntent({...valid,seoPolicy:'INDEX'}).result,'NO-GO');
 assert.equal(validateReleaseIntent({...valid,seoPolicy:'INDEX',flags:{...valid.flags,indexApproved:'true'}}).result,'READY-FOR-LIVE-PREFLIGHT');
 assert.equal(validateReleaseIntent({...valid,seoPolicy:'invalid'}).result,'NO-GO');
});
test('old-repo or modified release target fail closed',()=>{
 assert.equal(validateReleaseIntent({...valid,repository:'M0-coder/DESSET'}).result,'NO-GO');
 assert.equal(validateReleaseIntent({...valid,target:{...target,cloudflare_project:'other'}}).result,'NO-GO');
 assert.equal(validateReleaseIntent({...valid,target:{...target,production_deploy_enabled:true}}).result,'NO-GO');
});
test('realistic healthy Cloudflare snapshot passes only after authenticated GET',()=>{
 const r=validateCloudflareSnapshot(p);assert.equal(r.result,'READY-FOR-MANUAL-DEPLOY');
 assert.equal(r.previous_deployment_id,target.recovery_deployment_id);
});
test('changed live deployment, wrong branch and dirty commit fail',()=>{
 assert.equal(validateCloudflareSnapshot({...p,projectResponse:{result:{...project.result,latest_deployment:{...project.result.latest_deployment,id:'b'.repeat(8)+'-0000-0000-0000-000000000000'}}}}).result,'NO-GO');
 assert.equal(validateCloudflareSnapshot({...p,projectResponse:{result:{...project.result,production_branch:'main'}}}).result,'NO-GO');
 assert.equal(validateCloudflareSnapshot({...p,projectResponse:{result:{...project.result,latest_deployment:{...project.result.latest_deployment,deployment_trigger:{type:'ad_hoc',metadata:{commit_dirty:true}}}}}}).result,'NO-GO');
});
test('inactive domain, functions, bad account or API errors fail',()=>{
 assert.equal(validateCloudflareSnapshot({...p,domainsResponse:{result:[domains.result[0],{name:'www.desset.lat',status:'pending'}]}}).result,'NO-GO');
 assert.equal(validateCloudflareSnapshot({...p,projectResponse:{result:{...project.result,latest_deployment:{...project.result.latest_deployment,uses_functions:true}}}}).result,'NO-GO');
 assert.equal(validateCloudflareSnapshot({...p,actualAccount:'b'.repeat(32)}).result,'NO-GO');
 assert.equal(validateCloudflareSnapshot({...p,projectResponse:{success:false,result:project.result}}).result,'NO-GO');
});
