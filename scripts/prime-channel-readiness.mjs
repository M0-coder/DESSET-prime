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
 strict(Array.isArray(entries)&&entries.length===3,'unexpected owner-declared channel count');
 const approved=new Map();
 for(const item of entries){
  strict(['Instagram','X','Facebook'].includes(item.platform)&&
   item.status==='owner-attested'&&/^https:\/\/[^/\s]+\//.test(item.url)&&
   !approved.has(item.url),'invalid owner-declared URL');
  approved.set(item.url,item.platform);
 }
 strict(new Set(entries.map(x=>x.platform)).size===3,'duplicate attested platform');
 const external=[];
 for(const hit of html.matchAll(/<a\b([^>]+)>/g)){
  const a=hit[1],href=a.match(/\bhref="([^"]+)"/)?.[1]??'';
  if(!/^(?:https?:\/\/|mailto:|tel:)/i.test(href))continue;
  strict(href.startsWith('https://'),'external contact must use HTTPS');
  strict(!/\s|javascript:|data:/i.test(href),'untrusted external link');
  const state=a.match(/\bdata-channel-review="([^"]+)"/)?.[1]??'unclassified';
  const basis=a.match(/\bdata-channel-basis="([^"]+)"/)?.[1]??'none';
  strict(['pending','verified','unclassified'].includes(state),'unknown channel review state');
  if(a.includes('target="_blank"'))strict(/\brel="[^"]*\bnoopener\b[^"]*\bnoreferrer\b[^"]*"/.test(a),
   'unsafe external tab link');
  if(state==='verified'){
   strict(basis==='owner-attested','marked verified without owner-attested provenance: '+href);
   strict(approved.has(href),'approved channel URL differs from owner attestation: '+href);
  }else{
   strict(basis==='none','pending channel has misleading attested provenance');
  }
  external.push({href,state,basis,platform:approved.get(href)??'unclassified'});
 }
 strict(external.length>=3&&external.length<=8,'unexpected number of external links');
 for(const url of approved.keys()){
  strict(external.filter(x=>x.href===url).length===1,'owner-declared channel URL missing or duplicated: '+url);
 }
 const pending=external.filter(x=>x.state!=='verified');
 return {schema:'desset-prime-institutional-channel-audit-v2',
  source_record:'config/prime-social-owner-attestation.json',
  external_links:external,unconfirmed:pending,unconfirmed_count:pending.length,
  owner_attested_count:external.filter(x=>x.state==='verified').length,
  application_distribution:'not_published',web_payments:false,
  channels_status:pending.length?'PENDING':'OWNER_ATTESTED',
  real_world_account_ownership_verified:false,
  technical_platform_admin_access_tested:false,
  release_authorized:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const [htmlPath,statePath,reportPath,mode]=process.argv.slice(2);
  strict(htmlPath&&statePath&&isAbsolute(htmlPath)&&isAbsolute(statePath),'absolute source paths required');
  const report=inspectInstitutionalChannels({html:readFileSync(htmlPath,'utf8'),serviceState:readFileSync(statePath,'utf8')});
  if(reportPath){strict(isAbsolute(reportPath),'report path must be absolute');writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});}
  console.log(JSON.stringify({channels_status:report.channels_status,owner_attested_count:report.owner_attested_count,
   unconfirmed:report.unconfirmed_count,release_authorized:false,
   technical_platform_admin_access_tested:false}));
  if(mode==='--require-verified'&&report.unconfirmed_count)process.exitCode=2;
 }catch(e){console.error(e.message);process.exitCode=2;}
}
