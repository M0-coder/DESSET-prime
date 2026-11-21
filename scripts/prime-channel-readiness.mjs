/**
 * DESSET Prime institutional contact and application-state preflight.
 * Offline inspection; no network claims, no modification of the site.
 * A declaration of asset ownership does not verify external social destinations.
 */
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
const reject=(msg)=>{throw Error('NO-GO: '+msg)};
const strict=(ok,msg)=>{if(!ok)reject(msg)};
export function inspectInstitutionalChannels({html,serviceState}){
 strict(typeof html==='string'&&html.includes('<html lang="es">'),'Prime Spanish HTML missing');
 strict(html.includes('id="contacto"')&&html.includes('aria-labelledby="contact-title"'),'institutional contact missing');
 strict(html.includes('Esta web no procesa transacciones.')&&
   html.includes('las aplicaciones DESSET cuando estén habilitadas'),'no-commerce disclosure missing');
 strict(serviceState.includes('applicationDistribution:"not_published"')&&serviceState.includes('verified:false'),'published app claim not authorized');
 strict(!/<form\b/i.test(html)&&!/\b(?:checkout|payment|submit-order)\b/i.test(html),'unapproved transactional UI');
 const external=[];
 for(const hit of html.matchAll(/<a\b([^>]+)>/g)){
  const a=hit[1],href=a.match(/\bhref="([^"]+)"/)?.[1]??'';
  if(!/^(?:https?:\/\/|mailto:|tel:)/i.test(href))continue;
  strict(href.startsWith('https://'),'external contact must use HTTPS');
  strict(!/\s|javascript:|data:/i.test(href),'untrusted external link');
  const state=a.match(/\bdata-channel-review="([^"]+)"/)?.[1]??'unclassified';
  strict(['pending','verified','unclassified'].includes(state),'unknown channel review state');
  if(a.includes('target="_blank"'))strict(/\brel="[^"]*\bnoopener\b[^"]*\bnoreferrer\b[^"]*"/.test(a),
    'unsafe external tab link');
  external.push({href,state});
 }
 strict(external.length>=1&&external.length<=8,'unexpected number of official channels');
 const pending=external.filter(x=>x.state!=='verified');
 return {schema:'desset-prime-institutional-channel-audit-v1',
  external_links:external,unconfirmed:pending,unconfirmed_count:pending.length,
  application_distribution:'not_published',web_payments:false,
  channels_status:pending.length?'PENDING':'VERIFIED_IN_SOURCE',
  real_world_account_ownership_verified:false, // source markers are not third-party ownership proof
  release_authorized:false};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const [htmlPath,statePath,reportPath,mode]=process.argv.slice(2);
  strict(htmlPath&&statePath&&isAbsolute(htmlPath)&&isAbsolute(statePath),'absolute source paths required');
  const report=inspectInstitutionalChannels({html:readFileSync(htmlPath,'utf8'),
    serviceState:readFileSync(statePath,'utf8')});
  if(reportPath){strict(isAbsolute(reportPath),'report path must be absolute');writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n',{flag:'wx'});}
  console.log(JSON.stringify({channels_status:report.channels_status,unconfirmed:report.unconfirmed_count,
    names:report.unconfirmed.map(x=>x.href),release_authorized:false}));
  if(mode==='--require-verified'&&report.unconfirmed_count)process.exitCode=2;
 }catch(e){console.error(e.message);process.exitCode=2;}
}
