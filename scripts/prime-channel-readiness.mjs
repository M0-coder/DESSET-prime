/**
 * DESSET Prime institutional channel preflight.
 * Distinguishes owner's source attestation from independent platform-admin verification.
 * Offline, non-publishing, and fail-closed if an approved URL changes.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,isAbsolute,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const repositoryRoot=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const defaultAttestation=JSON.parse(readFileSync(join(repositoryRoot,'config/prime-social-owner-attestation.json'),'utf8'));
const reject=(message)=>{throw Error('NO-GO: '+message)};
const strict=(ok,msg)=>{if(!ok)reject(msg)};

export function inspectInstitutionalChannels({html,serviceState,attestation=defaultAttestation}){
 strict(typeof html==='string'&&html.includes('<html lang="es">'),'Prime Spanish HTML missing');
 strict(html.includes('id="contacto"')&&html.includes('aria-labelledby="contact-title"'),'institutional contact missing');
 strict(html.includes('Esta web no procesa transacciones.')&&
  html.includes('las aplicaciones DESSET cuando estén habilitadas'),'no-commerce disclosure missing');
 strict(typeof serviceState==='string'&&serviceState.includes('applicationDistribution:"not_published"')&&
  serviceState.includes('verified:false'),'published app claim not authorized');
 strict(!/<form\b/i.test(html)&&!/\b(?:checkout|payment|submit-order)\b/i.test(html),'unapproved transactional UI');
 strict(attestation?.schema==='desset-prime-social-owner-attestation-v1'&&
  attestation?.source_repository==='M0-coder/DESSET-prime'&&
  attestation?.assertion?.evidence_level==='owner-attested'&&
  attestation?.assertion?.technical_platform_admin_access_tested===false&&
  attestation?.assertion?.independently_verified_by_platform===false&&
  attestation?.release_authorized===false,'unsafe or exaggerated channel certification');
 const entries=attestation.exact_channels;
 const allowedHosts=Object.freeze({
  Instagram:'www.instagram.com',X:'x.com',Facebook:'www.facebook.com',
  TikTok:'www.tiktok.com',YouTube:'www.youtube.com'
 });
 strict(Array.isArray(entries)&&entries.length===5,'expected exactly five owner-declared channels');
 const approved=new Map();
 for(const item of entries){
  strict(Object.hasOwn(allowedHosts,item.platform)&&item.status==='owner-attested'&&
   typeof item.url==='string'&&!approved.has(item.url),'invalid owner-declared URL');
  let url;
  try{url=new URL(item.url);}catch{reject('malformed owner-declared URL');}
  strict(url.protocol==='https:'&&url.hostname===allowedHosts[item.platform]&&
   url.username===''&&url.password===''&&url.hash===''&&url.search===''&&
   url.pathname.length>1,'channel must use the expected platform HTTPS host and profile path');
  approved.set(item.url,item.platform);
 }
 strict(new Set(entries.map(x=>x.platform)).size===5,'duplicate attested platform');
 const nav=html.match(/<nav class="social-links social-links--official" aria-label="Redes sociales de DESSET">([\s\S]*?)<\/nav>/)?.[1];
 strict(typeof nav==='string'&&(nav.match(/<a\b/g)||[]).length===5,
  'five channels must appear together in the single institutional social navigation');
 strict(!html.includes('social-links--secondary'),'old split/secondary social block must not return');
 const external=[];
 for(const hit of html.matchAll(/<a\b([^>]+)>/g)){
  const a=hit[1],href=a.match(/\bhref="([^"]+)"/)?.[1]??'';
  if(!/^(?:https?:\/\/|mailto:|tel:)/i.test(href))continue;
  strict(href.startsWith('https://'),'external contact must use HTTPS');
  strict(!/\s|javascript:|data:/i.test(href),'untrusted external link');
  const state=a.match(/\bdata-channel-review="([^"]+)"/)?.[1]??'unclassified';
  const basis=a.match(/\bdata-channel-basis="([^"]+)"/)?.[1]??'none';
  strict(['pending','owner-attested','unclassified'].includes(state),'unknown channel review state');
  if(a.includes('target="_blank"'))strict(/\brel="[^"]*\bnoopener\b[^"]*\bnoreferrer\b[^"]*"/.test(a),
   'unsafe external tab link');
  if(state==='owner-attested'){
   strict(basis==='owner-attested','owner-attested channel without owner provenance: '+href);
   strict(approved.has(href),'approved channel URL differs from owner attestation: '+href);
  }else{
   strict(basis==='none','pending channel has misleading attested provenance');
  }
  external.push({href,state,basis,platform:approved.get(href)??'unclassified'});
 }
 strict(external.length>=5&&external.length<=8,'unexpected number of external links');
 for(const url of approved.keys()){
  strict(external.filter(x=>x.href===url).length===1,'owner-declared channel URL missing or duplicated: '+url);
 }
 const pending=external.filter(x=>x.state!=='owner-attested');
 return {schema:'desset-prime-institutional-channel-audit-v2',
  source_record:'config/prime-social-owner-attestation.json',
  external_links:external,unconfirmed:pending,unconfirmed_count:pending.length,
  owner_attested_count:external.filter(x=>x.state==='owner-attested').length,
  application_distribution:'not_published',web_payments:false,
  channels_status:pending.length?'PENDING':'OWNER_ATTESTED',
  real_world_account_ownership_verified:false,
  technical_platform_admin_access_tested:false,
  release_authorized:false};
}
// The protected production environment supplies the result of a private human review.
// Public attestations and ordinary offline/PR checks never read this record.
export function verifyAdminReview(report, reviewText, sourceSha){
 strict(typeof reviewText==='string'&&reviewText.trim().length>0,
  'independent platform ownership verification is required for manual production release');
 let review;
 try{review=JSON.parse(reviewText);}catch{reject('invalid private channel review JSON');}
 strict(review?.schema==='desset-prime-channel-admin-review-v1'&&
  review.repository==='M0-coder/DESSET-prime'&&typeof sourceSha==='string'&&
  /^[a-f0-9]{40}$/.test(sourceSha)&&review.source_sha===sourceSha,'channel review belongs to another release');
 const reviewedAt=Date.parse(review.reviewed_at);
 strict(typeof review.reviewer==='string'&&review.reviewer.trim().length>0&&
  Number.isFinite(reviewedAt)&&reviewedAt<=Date.now(),'missing reviewer or invalid review date');
 strict(report.unconfirmed_count===0&&report.owner_attested_count===5&&
  Array.isArray(review.channels)&&review.channels.length===5,'incomplete channel review');
 for(const link of report.external_links){
  const matches=review.channels.filter(entry=>entry?.platform===link.platform&&entry.url===link.href);
  strict(matches.length===1,'missing or duplicate review for '+link.platform);
  const entry=matches[0];
  strict(entry.method==='authenticated-admin-control-observed'&&
   typeof entry.evidence_sha256==='string'&&/^[a-f0-9]{64}$/.test(entry.evidence_sha256),
   'missing authenticated admin observation or evidence digest for '+link.platform);
 }
 return {...report,channels_status:'ADMIN_REVIEW_VERIFIED',
  real_world_account_ownership_verified:true,technical_platform_admin_access_tested:true};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const [htmlPath,statePath,reportPath,mode]=process.argv.slice(2);
  strict(htmlPath&&statePath&&isAbsolute(htmlPath)&&isAbsolute(statePath),'absolute source paths required');
  let report=inspectInstitutionalChannels({html:readFileSync(htmlPath,'utf8'),serviceState:readFileSync(statePath,'utf8')});
  if(mode==='--accept-owner-declaration'){
   const {CONTACT_APPROVED,RELEASE_SHA,GITHUB_SHA}=process.env;
   strict(CONTACT_APPROVED==='true'&&/^[a-f0-9]{40}$/.test(RELEASE_SHA??'')&&RELEASE_SHA===GITHUB_SHA,
    'contact approval must apply to the running release SHA');
   strict(report.channels_status==='OWNER_ATTESTED'&&report.unconfirmed_count===0&&report.owner_attested_count===5,
    'every public channel must match the owner declaration');
  }else if(mode!==undefined){
   strict(mode==='--require-verified','unknown channel verification mode');
   report=verifyAdminReview(report,process.env.DESSET_CHANNEL_ADMIN_REVIEW,process.env.GITHUB_SHA);
  }
  if(reportPath){strict(isAbsolute(reportPath),'report path must be absolute');writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});}
  console.log(JSON.stringify({channels_status:report.channels_status,owner_attested_count:report.owner_attested_count,
   unconfirmed:report.unconfirmed_count,release_authorized:false,
   technical_platform_admin_access_tested:report.technical_platform_admin_access_tested}));
 }catch(e){console.error(e.message);process.exitCode=2;}
}
