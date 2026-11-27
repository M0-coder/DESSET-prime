/**
 * DESSET Prime manual release preconditions. No network or deployment.
 * Cloudflare state MUST come from a fresh authenticated GET at execution time.
 */
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const targetPath=resolve(dirname(fileURLToPath(import.meta.url)),'../config/prime-release-target.json');
const HEX40=/^[a-f0-9]{40}$/,UUID=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const mark=(errors,condition,message)=>{if(!condition)errors.push(message)};
// An owner declaration is a scoped documentary basis, not independent license or title proof.
// Never use this result to bypass the protected production environment.
export function reviewSelectedMedia(media){
 const rejected={accepted:false,basis:'pending',individual_license_review_complete:false,release_authorized:false};
 if(media?.schema!=='desset-prime-selected-media-v1'||media.release_authorized!==false||!Array.isArray(media.assets)||media.assets.length!==4)return rejected;
 const expected=new Map([
  ['assets/ecosistema-proveedores.webp',['40236120','Pexels License','https://www.pexels.com/license/']],
  ['assets/ecosistema-comercios.webp',['26309839','Pexels License','https://www.pexels.com/license/']],
  ['assets/ecosistema-consumidores.webp',['DHnmO_mO0Pg','Unsplash License','https://unsplash.com/license']]
 ]);
 const external=media.assets.filter(a=>a?.claim==='third-party');
 const generated=media.assets.filter(a=>a?.claim==='ai-generated-owner-selected');
 if(external.length!==3||generated.length!==1||generated[0].path!=='assets/ecosistema-operadores-logisticos.webp'||generated[0].verification!=='owner-selected')return rejected;
 if(new Set(external.map(a=>a.path)).size!==3||external.some(a=>{
  const spec=expected.get(a.path);
  return !spec||a.source_id!==spec[0]||a.license!==spec[1]||a.license_url!==spec[2]||!/^[a-f0-9]{64}$/.test(a.sha256)||typeof a.source!=='string'||!a.source.includes(a.source_id)||!a.source.startsWith(a.license==='Pexels License'?'https://www.pexels.com/':'https://unsplash.com/photos/');
 }))return rejected;
 if(media.individual_license_review_complete===true&&external.every(a=>a.verification==='individual-source-verified'))return {accepted:true,basis:'individual-source-verified',individual_license_review_complete:true,release_authorized:false};
 const declaration=media.owner_attestation;
 if(media.individual_license_review_complete!==false||declaration?.status!=='owner-attested-free-download'||
  declaration.scope!=='ECOSYSTEM-PARTICIPANTS-01; illustrative website use of these three selected external photos only'||
  declaration.source!=='direct owner instruction in the project conversation'||typeof declaration.statement!=='string'||!declaration.statement.trim()||
  !/^\d{4}-\d{2}-\d{2}$/.test(declaration.date)||!/^\d{4}-\d{2}-\d{2}$/.test(declaration.general_license_terms_reviewed_on)||
  declaration.individual_source_verification!==false||declaration.independent_legal_verification!==false||declaration.exclusive_ownership_claim!==false||
  !Array.isArray(declaration.assets)||declaration.assets.length!==3)return rejected;
 if(!external.every(a=>{
  const matches=declaration.assets.filter(x=>x?.path===a.path);
  return matches.length===1&&['sha256','source_id','license','license_url'].every(key=>matches[0][key]===a[key]);
 }))return rejected;
 return {accepted:true,basis:'owner-attested-free-download',individual_license_review_complete:false,release_authorized:false};
}
// Six explicitly selected Prime page photographs; separate from the historical ecosystem attestation.
export function reviewPrimePageMedia(media){
 const items=media?.prime_page_assets;
 const names=["assets/prime-hero-logistica.webp","assets/prime-paqueteria.webp","assets/prime-distribucion.webp","assets/prime-fulfillment.webp","assets/prime-tecnologia-logistica.webp","assets/prime-vision-internacional.webp"];
 if(!Array.isArray(items)||items.length!==names.length||new Set(items.map(a=>a?.path)).size!==names.length)return false;
 return names.every((path,i)=>{
  const a=items.find(x=>x?.path===path);
  if(!a||! /^[a-f0-9]{64}$/.test(a.sha256)||!Number.isSafeInteger(a.bytes)||a.bytes<=0||!Number.isSafeInteger(a.width)||!Number.isSafeInteger(a.height)||a.width<=0||a.height<=0||typeof a.alt!=='string'||!a.alt.trim())return false;
  if(i===5)return a.claim==='third-party'&&a.author==='Tom Fisk'&&a.source_id==='1554646'&&a.source==='https://www.pexels.com/photo/aerial-view-of-cargo-ship-1554646/'&&a.license==='Pexels License'&&a.license_url==='https://www.pexels.com/license/'&&a.verification==='individual-source-verified';
  return a.claim==='ai-generated-owner-selected'&&a.source==='conversation-upload'&&a.license==='AI-generated; ownership not independently verified'&&a.license_url===null&&a.verification==='owner-selected'&&a.source_id==='owner-approved-2026-11-25';
 });
}
// PHOTO-01: scoped owner confirmation is not independent source verification.
export function reviewTalentPhoto(media){
 const rejected={accepted:false,basis:'pending',individual_source_verified:false,release_authorized:false};
 const a=media?.talent_photo;
 if(!a||a.path!=='assets/talento-cultura.webp'||a.source_id!=='4990531'||a.source!=='https://www.pexels.com/photo/4990531/'||a.claim!=='third-party'||a.license!=='Pexels License'||a.license_url!=='https://www.pexels.com/license/'||a.release_authorized!==false||!/^[a-f0-9]{64}$/.test(a.sha256)||!Number.isSafeInteger(a.bytes)||a.bytes<=0||a.bytes>230000||a.usage!=='Illustrative collaboration; not actual DESSET employees.')return rejected;
 if(a.verification==='individual-source-verified')return {accepted:true,basis:'individual-source-verified',individual_source_verified:true,release_authorized:false};
 const d=a.owner_attestation;
 if(a.verification!=='individual-source-pending'||d?.status!=='owner-attested-free-download'||d.scope!=='PHOTO-01; illustrative website use of this specific photo only'||d.source!=='direct owner instruction in the project conversation'||typeof d.statement!=='string'||!d.statement.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||!/^\d{4}-\d{2}-\d{2}$/.test(d.general_license_terms_reviewed_on)||d.individual_source_verification!==false||d.independent_legal_verification!==false||d.exclusive_ownership_claim!==false||!['path','sha256','source_id','license','license_url'].every(k=>d.asset?.[k]===a[k]))return rejected;
 return {accepted:true,basis:'owner-attested-free-download',individual_source_verified:false,release_authorized:false};
}
// PHOTO-02: the supplied filename identifies the source; approval is for illustrative use only.
export function reviewMerchantHeroPhoto(media){
 const rejected={accepted:false,basis:'pending',individual_source_verified:false,release_authorized:false};
 const a=media?.merchant_hero_photo;
 if(!a||a.path!=='assets/comercios-hero-minimercado.webp'||a.source_id!=='31487467'||a.source!=='https://www.pexels.com/photo/31487467/'||a.claim!=='third-party'||a.license!=='Pexels License'||a.license_url!=='https://www.pexels.com/license/'||a.release_authorized!==false||!/^[a-f0-9]{64}$/.test(a.sha256)||!Number.isSafeInteger(a.bytes)||a.bytes<=0||a.bytes>210000||a.width!==1800||a.height!==1200||a.usage!=='Illustrative storefront; no endorsement or affiliation implied.')return rejected;
 if(a.verification==='individual-source-verified')return {accepted:true,basis:'individual-source-verified',individual_source_verified:true,release_authorized:false};
 const d=a.selection;
 if(a.verification!=='source-identified-from-upload-filename'||d?.status!=='owner-supplied-and-approved-preview'||d.scope!=='PHOTO-02; illustrative website use of this specific photo only'||d.source!=='direct owner instruction in the project conversation'||!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||!/^\d{4}-\d{2}-\d{2}$/.test(d.general_license_terms_reviewed_on)||d.individual_source_verification!==false||d.independent_legal_verification!==false||d.exclusive_ownership_claim!==false||!['path','sha256','source_id','license','license_url'].every(k=>d.asset?.[k]===a[k]))return rejected;
 return {accepted:true,basis:'owner-supplied-and-approved-preview',individual_source_verified:false,release_authorized:false};
}
// PHOTO-05: source page and copyright license reviewed; no independent legal certification.
export function reviewHomeTalentPhoto(media){
 const rejected={accepted:false,basis:'pending',individual_source_verified:false,release_authorized:false};
 const a=media?.home_talent_photo,d=a?.selection;
 if(!a||a.path!=='assets/talento-equipo.webp'||a.source_id!=='Y5bvRlcCx8k'||a.source!=='https://unsplash.com/photos/team-members-gripping-wrists-in-unity-gesture-Y5bvRlcCx8k'||a.author!=='krakenimages'||a.claim!=='third-party'||a.license!=='Unsplash License'||a.license_url!=='https://unsplash.com/license'||a.release_authorized!==false||a.verification!=='source-page-and-license-reviewed'||!/^[a-f0-9]{64}$/.test(a.sha256)||!Number.isSafeInteger(a.bytes)||a.bytes<=0||a.bytes>100000||a.width!==1200||a.height!==900||a.usage!=='Illustrative teamwork; not actual DESSET employees.'||typeof a.alt!=='string'||!a.alt.trim())return rejected;
 if(d?.status!=='owner-supplied-and-approved-preview'||d.scope!=='PHOTO-05; homepage talent illustration only'||d.source!=='direct owner instruction in the project conversation'||d.date!=='2026-11-26'||d.source_page_reviewed_on!=='2026-11-26'||d.general_license_terms_reviewed_on!=='2026-11-26'||d.remote_original_binary_comparison!==false||d.independent_legal_verification!==false||d.exclusive_ownership_claim!==false||!['path','sha256','source_id','license','license_url'].every(k=>d.asset?.[k]===a[k]))return rejected;
 return {accepted:true,basis:'source-page-and-license-reviewed',individual_source_verified:false,release_authorized:false};
}
export function reviewRiderHeroPhoto(media){
 const rejected={accepted:false,basis:'pending',individual_source_verified:false,release_authorized:false};
 const a=media?.rider_hero_photo,d=a?.selection;
 if(!a||a.path!=='assets/repartidores-hero-original.jpg'||a.sha256!=='6a8a00bb029a440050ea93497efc61ff52687c9c1d4a895e1c46204e47018ebe'||a.bytes!==123996||a.width!==1024||a.height!==1280||a.claim!=='owner-supplied'||a.source!=='conversation-upload'||a.verification!=='owner-supplied-and-approved-use'||a.license!=='Owner-authorized website use; independent rights not verified'||a.release_authorized!==false||a.usage!=='Illustrative portrait; not actual DESSET operations or personnel.'||typeof a.alt!=='string'||!a.alt.trim())return rejected;
 if(d?.status!=='owner-supplied-and-approved-use'||d.date!=='2026-11-26'||d.scope!=='PHOTO-06; Repartidores institutional hero only'||d.source!=='direct owner instruction in the project conversation'||d.independent_legal_verification!==false||d.exclusive_ownership_claim!==false||d.asset?.path!==a.path||d.asset?.sha256!==a.sha256)return rejected;
 return {accepted:true,basis:'owner-supplied-and-approved-use',individual_source_verified:false,release_authorized:false};
}
// VIDEO-01: scoped owner attestation, not independent license verification or deployment approval.
export function reviewApplicationsHeroVideo(media){
 const a=media?.applications_hero_video;
 const expected={"path":"assets/aplicaciones-hero.mp4","sha256":"a355c981174fa77631890fa3f0c94fe15b96af9fbe50d52533989b895c53f01f","bytes":71003,"kind":"video","source_filename":"3315-168567021.mp4","source":"conversation-upload","verification":"owner-supplied-and-approved-use","independent_legal_verification":false,"release_authorized":false};
 const accepted=!!a&&Object.keys(a).length===Object.keys(expected).length&&Object.entries(expected).every(([k,v])=>a[k]===v);
 return {accepted,basis:accepted?"owner-supplied-and-approved-use":"pending",individual_source_verified:false,release_authorized:false};
}
export function reviewServiceVideos(media){
 const rejected={accepted:false,basis:'pending',individual_source_verified:false,release_authorized:false};
 const v=media?.service_videos,d=v?.owner_attestation;
 const approved=[{"path":"assets/servicio-desset.mp4","sha256":"592dd2d37d778a57d784195bd866d168243e973f3890064aab11c73e63d68bbc","bytes":1175493,"kind":"video","source_filename":"Fccyaq.mp4"},{"path":"assets/servicio-prime.mp4","sha256":"dcca0f7554c7e3267e141d8f4bdb19acde67f8628932b374ccad0962c19c2081","bytes":1620138,"kind":"video","source_filename":"23232-333604632.mp4"},{"path":"assets/servicio-desset-poster.webp","sha256":"c59181261f58aa6337eb1139e1e814222d1fc6657759795db7fc2a0b788d6733","bytes":10072,"kind":"poster","derived_from":"assets/servicio-desset.mp4"},{"path":"assets/servicio-prime-poster.webp","sha256":"ce1ed66071c700d3a921df00e668571403e6300c33192d7bff426d355c430a3c","bytes":41806,"kind":"poster","derived_from":"assets/servicio-prime.mp4"}];
 if(v?.scope!=='VIDEO-01; approved owner-supplied visual preview only'||v.source!=='conversation-upload'||v.verification!=='owner-attested-free-use'||v.release_authorized!==false||v.independent_legal_verification!==false||!Array.isArray(v.assets)||v.assets.length!==approved.length)return rejected;
 if(d?.status!=='owner-attested-free-use'||d.scope!==v.scope||!/^\d{4}-\d{2}-\d{2}$/.test(d.date)||d.source!=='direct owner instruction in the project conversation'||typeof d.statement!=='string'||!d.statement.trim()||d.individual_source_verification!==false||d.independent_legal_verification!==false||d.exclusive_ownership_claim!==false||!Array.isArray(d.assets)||d.assets.length!==approved.length)return rejected;
 for(const expected of approved){const a=v.assets.filter(x=>x?.path===expected.path),b=d.assets.filter(x=>x?.path===expected.path);if(a.length!==1||b.length!==1||!Object.keys(expected).every(k=>a[0][k]===expected[k])||!['path','sha256','bytes','kind'].every(k=>b[0][k]===expected[k]))return rejected;}
 return {accepted:true,basis:'owner-attested-free-use',individual_source_verified:false,release_authorized:false};
}
export function validateReleaseIntent({repository,ref,event,expectedSha,checkoutSha,previousId,seoPolicy,target}){
 const err=[];
 mark(err,repository===target?.repository,'Wrong GitHub repository');
 mark(err,event==='workflow_dispatch','Must be manually dispatched');
 mark(err,ref==='refs/heads/main','Only main may publish; PR branches forbidden');
 mark(err,HEX40.test(expectedSha)&&checkoutSha===expectedSha,'SHA mismatch with exact checkout');
 // The caller supplies the CURRENT production ID, checked against Cloudflare twice.
 // target.recovery_deployment_id is a HISTORICAL fallback, not the expected current ID.
 mark(err,UUID.test(previousId),'Expected CURRENT production deployment ID is not a valid UUID');
 mark(err,UUID.test(target?.recovery_deployment_id),'Historical recovery deployment ID is invalid');
 // INDEX is intentionally outside this single-approval workflow. Any future
 // indexation policy requires a separately reviewed code change.
 mark(err,seoPolicy==='NOINDEX','Only explicit NOINDEX publishing is permitted');
 mark(err,target?.schema==='desset-prime-release-target-v1'&&target?.production_deploy_enabled===false&&target?.requires_fresh_owner_approval===true,'Repository release target policy unexpectedly changed');
 mark(err,target?.cloudflare_project==='desset-institucional'&&target?.production_branch==='release-approved'&&target?.domain==='desset.lat','Wrong destination');
 // Human authorization is the required-reviewer decision on the protected
 // GitHub environment. Never infer approval from repository variables.
 return {result:err.length?'NO-GO':'READY-FOR-LIVE-PREFLIGHT',failures:err,release_authorized:false,requires_fresh_cloudflare_check:true};
}
export function validateCloudflareSnapshot({projectResponse,domainsResponse,previousId,expectedAccount,actualAccount}){
 const fail=[];const req=(v,s)=>mark(fail,v,s);
 const p=projectResponse?.result??projectResponse,d=domainsResponse?.result??domainsResponse;
 // canonical_deployment is the production serving target; latest may be a preview.
 const deployment=p?.canonical_deployment;
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
   const media=JSON.parse(readFileSync(resolve(dirname(targetPath),'prime-selected-media.json'),'utf8'));
   const mediaReview=reviewSelectedMedia(media);
   if(!mediaReview.accepted)throw Error('Selected photographs require a valid scoped review before production');
   if(!reviewPrimePageMedia(media))throw Error('Prime page photographs require a valid individual inventory before production');
   const talentReview=reviewTalentPhoto(media);
   if(!talentReview.accepted)throw Error('PHOTO-01: scoped photographic rights review required before production');
   const homeTalentReview=reviewHomeTalentPhoto(media);
   if(!homeTalentReview.accepted)throw Error('PHOTO-05: scoped homepage photograph review required before production');
   const appHeroReview=reviewApplicationsHeroVideo(media);
   if(!appHeroReview.accepted)throw Error('APP-HERO-VIDEO-01: scoped usage approval required before production');
   const serviceReview=reviewServiceVideos(media);
   if(!serviceReview.accepted)throw Error("VIDEO-01: scoped usage rights declaration required before production");
   const riderReview=reviewRiderHeroPhoto(media);
   if(!riderReview.accepted)throw Error('PHOTO-06: scoped rider portrait usage review required before production');
   const merchantReview=reviewMerchantHeroPhoto(media);
   if(!merchantReview.accepted)throw Error('PHOTO-02: scoped photographic source and usage review required before production');
   const e=process.env;
   const out=validateReleaseIntent({repository:e.GITHUB_REPOSITORY,ref:e.GITHUB_REF,event:e.GITHUB_EVENT_NAME,
     expectedSha:e.RELEASE_SHA,checkoutSha:e.GITHUB_SHA,previousId:e.PREVIOUS_DEPLOYMENT_ID,
     seoPolicy:e.SEO_POLICY,target});
   console.log(JSON.stringify({...out,selected_media_review:mediaReview,talent_media_review:talentReview,home_talent_media_review:homeTalentReview,merchant_hero_media_review:merchantReview,rider_hero_media_review:riderReview,service_video_media_review:serviceReview}));if(out.result!=='READY-FOR-LIVE-PREFLIGHT')process.exitCode=2;
  }else if(task==='cloudflare'){
   const [projectPath,domainPath]=process.argv.slice(3);
   const out=validateCloudflareSnapshot({projectResponse:JSON.parse(readFileSync(projectPath,'utf8')),
     domainsResponse:JSON.parse(readFileSync(domainPath,'utf8')),
     previousId:process.env.PREVIOUS_DEPLOYMENT_ID,expectedAccount:target.cloudflare_account_id,actualAccount:process.env.CLOUDFLARE_ACCOUNT_ID});
   console.log(JSON.stringify(out));if(out.result!=='READY-FOR-MANUAL-DEPLOY')process.exitCode=2;
  }else throw Error('Usage: node scripts/prime-manual-cutover-gate.mjs request|cloudflare ...');
 }catch(e){console.error('NO-GO: '+e.message);process.exitCode=2}
}
