/**
 * DESSET Prime manual release preconditions. No network or deployment.
 * Cloudflare state MUST come from a fresh authenticated GET at execution time.
 */
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const targetPath=resolve(dirname(fileURLToPath(import.meta.url)),'../config/prime-release-target.json');
const HEX40=/^[a-f0-9]{40}$/,UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export const CONFIRM='PUBLICAR_PRIME_DESSET';
const mark=(errors,condition,message)=>{if(!condition)errors.push(message)};
export function validateReleaseIntent({repository,ref,event,expectedSha,checkoutSha,previousId,confirm,seoPolicy,flags,target}){
 const err=[];
 mark(err,repository===target?.repository,'Wrong GitHub repository');
 mark(err,event==='workflow_dispatch','Must be manually dispatched');
 mark(err,ref==='refs/heads/main','Only main may publish; PR branches forbidden');
 mark(err,HEX40.test(expectedSha)&&checkoutSha===expectedSha,'SHA mismatch with exact checkout');
 mark(err,UUID.test(previousId)&&previousId===target?.recovery_deployment_id,'Rollback baseline different from reviewed ID');
 mark(err,confirm===CONFIRM,'Missing exact publication confirmation');
 mark(err,seoPolicy==='NOINDEX'||seoPolicy==='INDEX','SEO policy not explicit');
 mark(err,target?.schema==='desset-prime-release-target-v1'&&target?.production_deploy_enabled===false&&target?.requires_fresh_owner_approval===true,'Repository release target policy unexpectedly changed');
 mark(err,target?.cloudflare_project==='desset-institucional'&&target?.production_branch==='release-approved'&&target?.domain==='desset.lat','Wrong destination');
 mark(err,flags?.enabled==='true','Default-disabled release variable not enabled');
 mark(err,flags?.visualApprovedSha===expectedSha,'Visual approval does not cover this exact SHA');
 mark(err,flags?.rightsApproved==='true','Brand and imagery rights not approved');
 mark(err,flags?.contactApproved==='true','Institutional contact not approved');
 mark(err,flags?.securityApproved==='true','Security and physical-device gate not approved');
 if(seoPolicy==='INDEX')mark(err,flags?.indexApproved==='true','Search engine indexation not approved');
 return {result:err.length?'NO-GO':'READY-FOR-LIVE-PREFLIGHT',failures:err,release_authorized:false,requires_fresh_cloudflare_check:true};
}
export function validateCloudflareSnapshot({projectResponse,domainsResponse,previousId,expectedAccount,actualAccount}){
 const fail=[];const req=(v,s)=>mark(fail,v,s);
 const p=projectResponse?.result??projectResponse,d=domainsResponse?.result??domainsResponse;
 const deployment=p?.latest_deployment;
 req(projectResponse?.success!==false && domainsResponse?.success!==false,'Cloudflare API failed');
 req(typeof expectedAccount==='string'&&/^[a-f0-9]{32}$/.test(expectedAccount)&&expectedAccount===actualAccount,'Wrong account ID');
 req(p?.name==='desset-institucional'&&p?.production_branch==='release-approved','Wrong Pages project or production branch');
 req(UUID.test(previousId)&&deployment?.id===previousId,'Production was modified after approval; stop and re-review');
 req(deployment?.environment==='production'&&deployment?.latest_stage?.status==='success','Prior production not healthy');
 req(deployment?.uses_functions===false,'Unexpected Pages Functions in deployment');
 req(deployment?.deployment_trigger?.type==='ad_hoc','Unexpected deployment origin');
 req(deployment?.deployment_trigger?.metadata?.commit_dirty===false,'Production commit marked dirty');
 for(const host of ['desset.lat','www.desset.lat'])req(Array.isArray(d)&&d.some(x=>x.name===host&&x.status==='active'),'Inactive or unknown domain: '+host);
 return {result:fail.length?'NO-GO':'READY-FOR-MANUAL-DEPLOY',failures:fail,previous_deployment_id:previousId};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const task=process.argv[2],target=JSON.parse(readFileSync(targetPath,'utf8'));
  if(task==='request'){
   const e=process.env;
   const out=validateReleaseIntent({repository:e.GITHUB_REPOSITORY,ref:e.GITHUB_REF,event:e.GITHUB_EVENT_NAME,
     expectedSha:e.RELEASE_SHA,checkoutSha:e.GITHUB_SHA,previousId:e.PREVIOUS_DEPLOYMENT_ID,
     confirm:e.CONFIRM,seoPolicy:e.SEO_POLICY,target,
     flags:{enabled:e.RELEASE_ENABLED,visualApprovedSha:e.VISUAL_APPROVED_SHA,
       rightsApproved:e.RIGHTS_APPROVED,contactApproved:e.CONTACT_APPROVED,
       securityApproved:e.SECURITY_APPROVED,indexApproved:e.INDEX_APPROVED}});
   console.log(JSON.stringify(out));if(out.result!=='READY-FOR-LIVE-PREFLIGHT')process.exitCode=2;
  }else if(task==='cloudflare'){
   const [projectPath,domainPath]=process.argv.slice(3);
   const out=validateCloudflareSnapshot({projectResponse:JSON.parse(readFileSync(projectPath,'utf8')),
     domainsResponse:JSON.parse(readFileSync(domainPath,'utf8')),
     previousId:process.env.PREVIOUS_DEPLOYMENT_ID,expectedAccount:target.cloudflare_account_id,actualAccount:process.env.CLOUDFLARE_ACCOUNT_ID});
   console.log(JSON.stringify(out));if(out.result!=='READY-FOR-MANUAL-DEPLOY')process.exitCode=2;
  }else throw Error('Usage: node scripts/prime-manual-cutover-gate.mjs request|cloudflare ...');
 }catch(e){console.error('NO-GO: '+e.message);process.exitCode=2}
}
