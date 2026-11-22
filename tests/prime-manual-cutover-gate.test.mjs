import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {validateReleaseIntent,validateCloudflareSnapshot} from '../scripts/prime-manual-cutover-gate.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const target=JSON.parse(readFileSync(root+'/config/prime-release-target.json','utf8'));
const sha='a'.repeat(40);
const valid={repository:'M0-coder/DESSET-prime',ref:'refs/heads/main',event:'workflow_dispatch',
 expectedSha:sha,checkoutSha:sha,previousId:target.recovery_deployment_id,seoPolicy:'NOINDEX',target};
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
test('manual publishing requires exact SHA, current UUID and NOINDEX',()=>{
 for(const overrides of [{checkoutSha:'b'.repeat(40)},{expectedSha:'b'.repeat(40)},
  {previousId:'invalid-current-id'},{seoPolicy:'INDEX'},{seoPolicy:''}])
  assert.equal(validateReleaseIntent({...valid,...overrides}).result,'NO-GO');
});

test('SECOND production cutover permits a new CURRENT deployment while keeping old recovery ID immutable',()=>{
 const current='0effd29b-f675-4529-bca9-2df86211983e';
 assert.notEqual(current,target.recovery_deployment_id);
 assert.equal(target.recovery_deployment_id,'b107eff2-6511-4e04-a780-fbd28e93e4e9');
 const request=validateReleaseIntent({...valid,previousId:current});
 assert.equal(request.result,'READY-FOR-LIVE-PREFLIGHT',JSON.stringify(request.failures));
 const currentProject={success:true,result:{...project.result,
  canonical_deployment:{...project.result.canonical_deployment,id:current}}};
 const fresh={...p,previousId:current,projectResponse:currentProject};
 assert.equal(validateCloudflareSnapshot(fresh).result,'READY-FOR-MANUAL-DEPLOY');
 assert.equal(validateCloudflareSnapshot({...fresh,previousId:target.recovery_deployment_id}).result,'NO-GO');
 assert.equal(validateCloudflareSnapshot({...fresh,projectResponse:project}).result,'NO-GO');
});
test('invalid recovery metadata and a missing expected live ID fail before any Cloudflare credential',()=>{
 assert.equal(validateReleaseIntent({...valid,previousId:''}).result,'NO-GO');
 assert.equal(validateReleaseIntent({...valid,target:{...target,recovery_deployment_id:'invalid'}}).result,'NO-GO');
});

test('old redundant approval flags and confirmation are not part of the technical gate',()=>{
 const clean=validateReleaseIntent(valid);
 assert.equal(clean.result,'READY-FOR-LIVE-PREFLIGHT');
 const legacy=validateReleaseIntent({...valid,confirm:undefined,flags:{enabled:'false',visualApprovedSha:'0'.repeat(40),contactApproved:'false'}});
 assert.deepEqual(legacy,clean);
 assert.equal(clean.release_authorized,false,'Only the GitHub protected environment can authorize publication');
});
test('INDEX is never allowed in the single-approval workflow',()=>{
 assert.equal(validateReleaseIntent({...valid,seoPolicy:'INDEX'}).result,'NO-GO');
 assert.equal(validateReleaseIntent({...valid,seoPolicy:'NOINDEX'}).result,'READY-FOR-LIVE-PREFLIGHT');
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
