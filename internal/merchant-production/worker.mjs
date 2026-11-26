// MERCHANT-PRODUCTION-01. Cloudflare Worker candidate, not deployed.
// Explicit bindings and database flags must both be enabled by authorized operators.
// Production and staging share code, but hostnames, DBs, authorization and notification delivery remain isolated.
import {merchantFields as fields,validateMerchantInput} from "../merchant-common/validation.mjs";
import {resolveTerritory} from "../merchant-common/territory.mjs";
import {createRegistrationShell,createRegistrationRenderer,validateRegistrationForm,privateStyle,privateAdminStyle} from "../merchant-common/registration-view.mjs";
import {territoryScript} from "../merchant-common/location-ui.mjs";
import {originFor,productionGate,PRODUCTION_ORIGIN,approvedPrivacyNotice} from "./production-gates.mjs";
export {PRODUCTION_ORIGIN};
import {reconcileNotification,changeAccountStatus,accountHistory,notificationHistory} from "./operations.mjs";
import {uploadDocument,listEvidence,downloadDocument,reviewDocument,saveConfiguration} from "./evidence.mjs";
import {getPreparation,recordContact,editProfile,reviewProfile,uploadProfileMedia,readProfileMedia} from "./profile.mjs";
import {preparationPage} from "./profile-view.mjs";
import {issueAcceptance,acceptanceView,decideAcceptance,listAcceptances,revokeAcceptance} from "./acceptance.mjs";
export const STAGING_ORIGIN="https://desset-merchant-staging.morimil-pabfelon.workers.dev";
const sec={"Cache-Control":"no-store","Content-Security-Policy":"default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow"};
const fail=(status,code)=>Object.assign(new Error(code),{status,publicCode:code});
const json=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{...sec,"Content-Type":"application/json; charset=utf-8"}});
const html=(body,status=200)=>new Response('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DESSET — Solicitudes privadas</title><link rel="stylesheet" href="/admin/assets/styles-typography.css"><link rel="stylesheet" href="/admin/assets/merchant-registration.css"></head><body class="merchant-admin"><main><h1>DESSET — Incorporación comercial</h1>'+body+'</main></body></html>',{status,headers:{...sec,"Content-Security-Policy":"default-src \'none\'; style-src \'self\'; img-src \'self\'; font-src \'self\'; form-action \'self\'; frame-ancestors \'none\'; base-uri \'none\'","Content-Type":"text/html; charset=utf-8"}});
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const enc=new TextEncoder();
const digest=async v=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(v))),x=>x.toString(16).padStart(2,"0")).join("");
const validKey=v=>typeof v==="string"&&/^[A-Za-z0-9_-]{16,100}$/.test(v);
const uuid=v=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const exact=(obj,keys)=>obj&&typeof obj==="object"&&!Array.isArray(obj)&&Object.keys(obj).every(k=>keys.includes(k));
export function normalize(input){
 try{return validateMerchantInput(input);}catch(e){throw fail(400,e.message);}
}
export function normalizeComplete(input){
 const d=normalize(input);
 if(!d.postal_code||!d.interest_level)throw fail(400,"INCOMPLETE_REGISTRATION");
 try{return {...d,...resolveTerritory(d.department,d.province,d.district)};}catch{throw fail(400,"INVALID_LOCATION");}
}
async function body(req,kind){
 if((req.headers.get("content-type")??"").split(";")[0].trim()!==kind)throw fail(415,"CONTENT_TYPE");
 if(!req.body)throw fail(400,"INVALID_BODY");
 const reader=req.body.getReader();let n=0;const decoder=new TextDecoder("utf-8",{fatal:true});let raw="";
 try{while(true){const {done,value}=await reader.read();if(done)break;n+=value.length;if(n>8192){await reader.cancel();throw fail(413,"BODY_LIMIT");}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}catch(e){if(e.status)throw e;throw fail(400,"INVALID_BODY");}finally{reader.releaseLock();}
 try{if(kind==="application/json"){const v=JSON.parse(raw);if(!v||typeof v!=="object"||Array.isArray(v))throw Error();return v;}const p=new URLSearchParams(raw);if(new Set(p.keys()).size!==[...p.keys()].length)throw Error();return Object.fromEntries(p);}catch{throw fail(400,"INVALID_BODY");}
}
const bytes=s=>{if(!/^[A-Za-z0-9_-]+$/.test(s))throw Error("JWT_FORMAT");return Uint8Array.from(atob(s.replace(/-/g,"+").replace(/_/g,"/").padEnd(Math.ceil(s.length/4)*4,"=")),c=>c.charCodeAt(0));};
const decode=s=>JSON.parse(new TextDecoder().decode(bytes(s)));
export async function verifyAccess(req,env,fetcher=fetch,now=Math.floor(Date.now()/1000)){
 // MFA is enforced by the dedicated Access application policy. No client-declared actor or role.
 // ADMIN_POLICY_VERIFIED remains off until the policy and negative MFA tests are evidenced.
 if(env.ADMIN_POLICY_VERIFIED!=="true"||!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(env.ACCESS_ISSUER??"")||!/^[a-f0-9]{64}$/.test(env.ACCESS_AUD??"")||!env.ADMIN_SUBJECTS)throw fail(503,"ADMIN_DISABLED");
 try{
 const raw=req.headers.get("Cf-Access-Jwt-Assertion");if(!raw||raw.length>16384)throw Error();
 const parts=raw.split(".");if(parts.length!==3)throw Error();
 const h=decode(parts[0]),p=decode(parts[1]);if(h.alg!=="RS256"||typeof h.kid!=="string"||h.crit||p.iss!==env.ACCESS_ISSUER||!Array.isArray(p.aud)||!p.aud.includes(env.ACCESS_AUD)||!Number.isSafeInteger(p.exp)||p.exp<=now||!Number.isSafeInteger(p.iat)||p.iat>now+30||(p.nbf!==undefined&&(!Number.isSafeInteger(p.nbf)||p.nbf>now))||typeof p.sub!=="string"||!env.ADMIN_SUBJECTS.split(",").map(x=>x.trim()).includes(p.sub)||typeof p.email!=="string"||!p.email.includes("@")||p.exp<=p.iat||p.exp-p.iat>900||p.type!=="app")throw Error();
 const r=await fetcher(env.ACCESS_ISSUER+"/cdn-cgi/access/certs",{redirect:"error",signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error();
 const keys=(await r.json()).keys;if(!Array.isArray(keys))throw Error();const matches=keys.filter(k=>k.kid===h.kid&&k.kty==="RSA"&&(!k.alg||k.alg==="RS256")&&(!k.use||k.use==="sig"));if(matches.length!==1)throw Error();const jwk=matches[0];
 const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
 if(!await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,bytes(parts[2]),enc.encode(parts[0]+"."+parts[1])))throw Error();
 return p.sub;
 }catch{throw fail(403,"ACCESS_DENIED");}
}
// Only the Cloudflare runtime can supply ctx.access. A copied signed JWT alone is insufficient.
async function authorize(req,env,ctx,fetcher,now){
 if(env.ADMIN_POLICY_VERIFIED!=="true")throw fail(503,"ADMIN_DISABLED");
 if(!ctx?.access||ctx.access.aud!==env.ACCESS_AUD||typeof ctx.access.getIdentity!=="function")throw fail(403,"ACCESS_CONTEXT_REQUIRED");
 const actor=await verifyAccess(req,env,fetcher,now);
 try{
 const identity=await ctx.access.getIdentity();
 const raw=req.headers.get("Cf-Access-Jwt-Assertion"),claims=decode(raw.split(".")[1]);
 if(typeof env.ADMIN_EMAIL!=="string"||!env.ADMIN_EMAIL||typeof identity?.email!=="string"||identity.email.toLowerCase()!==claims.email.toLowerCase()||identity.email.toLowerCase()!==env.ADMIN_EMAIL.toLowerCase())throw Error();
 return {actor,csrf:await digest("desset-admin-review-v1:"+raw)};
 }catch{throw fail(403,"ACCESS_DENIED");}
}
async function state(env){if(!env.DB)throw fail(503,"UNAVAILABLE");const s=await env.DB.prepare("SELECT environment,intake_enabled,notification_enabled,privacy_version,activation_enabled FROM merchant_runtime WHERE id=1").first();if(!s||s.environment!==env.ENVIRONMENT||!["staging","production"].includes(s.environment))throw fail(503,"UNAVAILABLE");return s;}
export async function turnstile(token,env,fetcher=fetch){
 if(typeof token!=="string"||token.length<1||token.length>2048||!env.TURNSTILE_SECRET||!env.TURNSTILE_HOST)throw fail(400,"CHALLENGE_REQUIRED");
 let r;try{r=await fetcher("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({secret:env.TURNSTILE_SECRET,response:token}),redirect:"error",signal:AbortSignal.timeout(5000)});}catch{throw fail(503,"CHALLENGE_UNAVAILABLE");}
 if(!r.ok)throw fail(503,"CHALLENGE_UNAVAILABLE");const v=await r.json();if(v.success!==true||v.hostname!==env.TURNSTILE_HOST||v.action!=="merchant_intake")throw fail(403,"CHALLENGE_INVALID");
}
export async function submit(req,env,fetcher=fetch){
 const s=env.ENVIRONMENT==="production"?await productionGate(env,"intake"):await state(env);
 if(env.INTAKE_ENABLED!=="true"||s.intake_enabled!==1||!s.privacy_version||env.PRIVACY_VERSION!==s.privacy_version)throw fail(503,"INTAKE_DISABLED");
 if(!env.INTAKE_LIMIT||!req.headers.get("CF-Connecting-IP"))throw fail(503,"UNAVAILABLE");
 if(!(await env.INTAKE_LIMIT.limit({key:req.headers.get("CF-Connecting-IP")})).success)throw fail(429,"RATE_LIMIT");
 const b=await body(req,"application/json");if(!exact(b,["input","requestKey","privacyVersion","consent","turnstileToken"])||!validKey(b.requestKey)||b.consent!==true||b.privacyVersion!==s.privacy_version)throw fail(400,"INVALID_REQUEST");
 const d=normalizeComplete(b.input);
 if(s.environment==="staging"&&(!d.business_name.startsWith("Synthetic ")||!d.email.endsWith(".invalid")||d.phone!=="+51900000000"))throw fail(400,"SYNTHETIC_ONLY");
 await turnstile(b.turnstileToken,env,fetcher);
 return persistRequest(env,d,{requestKey:b.requestKey,privacyVersion:b.privacyVersion,environment:s.environment});
}
async function persistRequest(env,d,b,draft=null){
 const hash=await digest(JSON.stringify([d,b.privacyVersion])),identity=await digest(JSON.stringify(["business_name","department","province","district","address"].map(k=>d[k].normalize("NFKC").toLowerCase().replace(/\s+/g," "))));
 const id=crypto.randomUUID(),at=Date.now();
 try{
 // The database trigger creates the outbox in the same statement. Runtime gate checked at write time.
 const gate=draft&&b.environment==="production"?"EXISTS (SELECT 1 FROM merchant_runtime WHERE id=1 AND environment='production' AND intake_enabled=1 AND privacy_version=? AND launch_authorization_ref=?) AND EXISTS (SELECT 1 FROM merchant_drafts WHERE key_hash=? AND actor_id=? AND request_key=? AND expires_at>? AND receipt_id IS NULL)":draft?"EXISTS (SELECT 1 FROM merchant_runtime WHERE id=1 AND environment='staging' AND intake_enabled=0 AND notification_enabled=0 AND activation_enabled=0) AND EXISTS (SELECT 1 FROM merchant_drafts WHERE key_hash=? AND actor_id=? AND request_key=? AND expires_at>? AND receipt_id IS NULL)":b.environment==="production"?"EXISTS (SELECT 1 FROM merchant_runtime WHERE id=1 AND environment=? AND intake_enabled=1 AND privacy_version=? AND launch_authorization_ref=?)":"EXISTS (SELECT 1 FROM merchant_runtime WHERE id=1 AND environment=? AND intake_enabled=1 AND privacy_version=?)";
 const gateArgs=draft?(b.environment==="production"?[b.privacyVersion,env.LAUNCH_AUTHORIZATION_REF,draft.keyHash,draft.actor,b.requestKey,at]:[draft.keyHash,draft.actor,b.requestKey,at]):(b.environment==="production"?[b.environment,b.privacyVersion,env.LAUNCH_AUTHORIZATION_REF]:[b.environment,b.privacyVersion]);
 const result=await env.DB.prepare("INSERT INTO merchant_requests(id,request_key,payload_hash,identity_hash,business_name,category,department,province,district,address,contact_name,phone,email,observations,postal_code,interest_level,contact_pronunciation,ubigeo,privacy_version,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE "+gate+" ON CONFLICT(request_key) DO NOTHING RETURNING id").bind(id,b.requestKey,hash,identity,...fields.map(k=>d[k]),d.observations??null,d.postal_code,d.interest_level,d.contact_pronunciation??null,d.ubigeo,b.privacyVersion,at,...gateArgs).first();
 if(result?.id===id)return json({id,replayed:false},201);
 }catch(e){if(String(e.message).includes("UNIQUE constraint failed: merchant_requests.identity_hash"))throw fail(409,"REQUEST_CONFLICT");throw e;}
 const old=await env.DB.prepare("SELECT id,payload_hash FROM merchant_requests WHERE request_key=?").bind(b.requestKey).first();
 if(!old)throw fail(draft?409:503,draft?"DRAFT_EXPIRED":"INTAKE_DISABLED");if(old.payload_hash!==hash)throw fail(409,"REQUEST_CONFLICT");return json({id:old.id,replayed:true});
}
async function list(env,offset,status=null,reference=null){if(!Number.isSafeInteger(offset)||offset<0||offset>1000000)throw fail(400,"INVALID_OFFSET");if(status!==null&&!["PENDING","APPROVED","REJECTED"].includes(status)||reference!==null&&!uuid(reference))throw fail(400,"INVALID_FILTER");const r=await env.DB.prepare("SELECT r.id,r.business_name,r.category,r.department,r.province,r.district,r.address,r.contact_name,r.phone,r.email,r.observations,r.postal_code,r.interest_level,r.contact_pronunciation,r.ubigeo,r.created_at,r.status,e.actor_id,e.created_at reviewed_at,o.status notification_status,o.attempts,o.provider_message_id,n.stage onboarding_stage,n.evidence_ref onboarding_evidence,a.status account_status,a.version account_version FROM merchant_requests r JOIN merchant_notification_outbox o ON o.request_id=r.id LEFT JOIN merchant_review_events e ON e.request_id=r.id LEFT JOIN merchant_onboarding n ON n.request_id=r.id LEFT JOIN merchant_accounts a ON a.request_id=r.id WHERE (? IS NULL OR r.status=?) AND (? IS NULL OR r.id=?) ORDER BY r.created_at,r.id LIMIT 50 OFFSET ?").bind(status,status,reference,reference,offset).all();return r.results;}
async function review(env,actor,b){if(!exact(b,["id","decision"])||!uuid(b.id)||!["APPROVED","REJECTED"].includes(b.decision))throw fail(400,"INVALID_DECISION");const r=await env.DB.prepare("UPDATE merchant_requests SET status=?,reviewed_by=?,reviewed_at=? WHERE id=? AND status='PENDING' RETURNING id").bind(b.decision,actor,Date.now(),b.id).first();if(r?.id!==b.id)throw fail(409,"NOT_PENDING");return {id:b.id,status:b.decision};}
const nextStage=Object.freeze({EVALUATION_APPROVED:"DOCUMENTATION_VERIFIED",DOCUMENTATION_VERIFIED:"CONTRACT_VERIFIED",CONTRACT_VERIFIED:"CONFIGURATION_VERIFIED",CONFIGURATION_VERIFIED:"READY_FOR_ACTIVATION"});
const stageLabels=Object.freeze({DOCUMENTATION_VERIFIED:"Verificar documentación",CONTRACT_VERIFIED:"Verificar contrato",CONFIGURATION_VERIFIED:"Verificar configuración",READY_FOR_ACTIVATION:"Preparar para autorización de activación"});
export async function advanceOnboarding(env,actor,b){
 if(!exact(b,["id","from","to","evidence"])||!uuid(b.id)||!Object.hasOwn(nextStage,b.from)||nextStage[b.from]!==b.to||typeof b.evidence!=="string"||!/^[A-Za-z0-9][A-Za-z0-9_.:-]{2,119}$/.test(b.evidence)||typeof actor!=="string"||!actor.trim())throw fail(400,"INVALID_ONBOARDING");
 const runtime=await state(env);
 if(runtime.environment==="staging"&&(runtime.intake_enabled!==0||runtime.notification_enabled!==0||runtime.activation_enabled!==0))throw fail(503,"STAGING_NOT_ISOLATED");
 if(runtime.environment==="staging"&&!/^SYNTHETIC-[A-Za-z0-9_-]{3,80}$/.test(b.evidence))throw fail(400,"SYNTHETIC_ONLY");
 const r=await env.DB.prepare("UPDATE merchant_onboarding SET stage=?,actor_id=?,evidence_ref=?,updated_at=? WHERE request_id=? AND stage=? AND EXISTS (SELECT 1 FROM merchant_requests WHERE id=? AND status='APPROVED') AND EXISTS (SELECT 1 FROM merchant_runtime WHERE id=1 AND environment=? AND (environment='production' OR (intake_enabled=0 AND notification_enabled=0 AND activation_enabled=0))) RETURNING stage").bind(b.to,actor,b.evidence,Date.now(),b.id,b.from,b.id,runtime.environment).first().catch(e=>{if(String(e.message).includes('EVIDENCE_REQUIRED'))throw fail(409,'EVIDENCE_REQUIRED');if(String(e.message).includes('PROFILE_APPROVAL_REQUIRED'))throw fail(409,'PROFILE_APPROVAL_REQUIRED');if(String(e.message).includes('DIRECT_CONFORMITY_REQUIRED'))throw fail(409,'DIRECT_CONFORMITY_REQUIRED');throw e;});
 if(r?.stage!==b.to)throw fail(409,"ONBOARDING_CONFLICT");return {id:b.id,stage:b.to};
}
function onboardingForm(r,csrf,production=false){
 const next=nextStage[r.onboarding_stage];if(!next)return "";
 return '<form method="post" action="/admin/onboarding"><input type="hidden" name="id" value="'+esc(r.id)+'"><input type="hidden" name="from" value="'+esc(r.onboarding_stage)+'"><input type="hidden" name="to" value="'+esc(next)+'"><input type="hidden" name="csrf" value="'+esc(csrf)+'"><label>Referencia de evidencia '+(production?"verificada":"sintética")+' <input required name="evidence" maxlength="120"></label><button>'+esc(stageLabels[next])+'</button></form>';
}
function operationForms(r,csrf,production=false){
 const h=(k,v)=>'<input type="hidden" name="'+esc(k)+'" value="'+esc(v)+'">';
 const base=h("id",r.id)+h("csrf",csrf);
 let out='<p>Cuenta comercial: '+esc(r.account_status??"Todavía no preparada")+'</p><p><a href="/admin/api/history?id='+encodeURIComponent(r.id)+'">Historial de cuenta y notificaciones (JSON)</a></p>';
 if(r.notification_status==="NEEDS_REVIEW")out+='<form method="post" action="/admin/notification">'+base+'<label>Referencia de evidencia <input name="evidence" required maxlength="120"></label><label>Referencia del proveedor (solo si confirmó envío) <input name="providerMessageId" maxlength="120"></label><button name="decision" value="CONFIRMED_SENT">Confirmar enviado</button><button name="decision" value="CONFIRMED_NOT_SENT">Reencolar envío no realizado</button></form>';
 if(["READY","ACTIVE","SUSPENDED"].includes(r.account_status))out+='<form method="post" action="/admin/account">'+base+h("from",r.account_status)+h("version",r.account_version)+'<label>Motivo <input name="reason" required maxlength="300"></label>'+(r.account_status==="ACTIVE"?'<button name="to" value="SUSPENDED">Suspender</button>':"")+(production&&["READY","SUSPENDED"].includes(r.account_status)?'<label>Autorización de activación <input name="authorization" maxlength="120"></label><button name="to" value="ACTIVE">Activar con autorización</button>':"")+'<button name="to" value="DEACTIVATED">Desactivar</button></form>';
 return out;
}
function panel(rows,offset,csrf,status=null,reference=null,production=false){return html('<p>Aprobar una solicitud no activa un comercio.</p>'+(production?"":'<p><a href="/admin/merchant">Registrar solicitud de ensayo</a></p>')+'<form method="get" action="/admin"><label>Estado <select name="status"><option value="">Todos</option>'+["PENDING","APPROVED","REJECTED"].map(v=>'<option value="'+v+'"'+(status===v?" selected":"")+'>'+v+'</option>').join("")+'</select></label><label>Referencia <input name="id" value="'+esc(reference)+'" maxlength="36"></label><button>Buscar</button></form>'+rows.map(r=>'<article><h2>'+esc(r.business_name)+'</h2><p>Referencia '+esc(r.id)+' · '+esc(r.status)+'</p><p>'+esc(r.category)+' | '+esc(r.department)+' / '+esc(r.province)+' / '+esc(r.district)+' · '+esc(r.address)+'</p><p>'+esc(r.contact_name)+' · '+esc(r.phone)+' · '+esc(r.email)+'</p><p>'+esc(r.observations)+'</p><p>UBIGEO: '+esc(r.ubigeo)+' | CP: '+esc(r.postal_code)+' | Interés: '+esc(r.interest_level)+' | Pronunciación: '+esc(r.contact_pronunciation)+'</p><p>Incorporación: '+esc(r.onboarding_stage)+'</p><p>Notificación: '+esc(r.notification_status)+' · Intentos: '+esc(r.attempts)+'</p><p>Revisión: '+esc(r.actor_id)+' · '+esc(r.reviewed_at)+'</p>'+(r.status==="PENDING"?'<form method="post" action="/admin/review"><input type="hidden" name="id" value="'+esc(r.id)+'"><input type="hidden" name="csrf" value="'+esc(csrf)+'"><button name="decision" value="APPROVED">Aprobar</button> <button name="decision" value="REJECTED">Rechazar</button></form>':'')+(r.status==="APPROVED"?'<p><a href="/admin/evidence?id='+encodeURIComponent(r.id)+'">Documentación, contrato y configuración</a></p>':"")+'<p><a href="/admin/profile?id='+encodeURIComponent(r.id)+'">Seguimiento y ficha comercial</a></p>'+(r.status==="APPROVED"?'<p><a href="/admin/conformidad?id='+encodeURIComponent(r.id)+'">Conformidad del comercio</a></p>':"")+onboardingForm(r,csrf,production)+operationForms(r,csrf,production)+'</article>').join('')+(offset?'<a href="/admin?'+new URLSearchParams({offset:String(Math.max(0,offset-50)),...(status?{status}:{}),...(reference?{id:reference}:{})})+'">Anterior</a> ':'')+(rows.length===50?'<a href="/admin?'+new URLSearchParams({offset:String(offset+50),...(status?{status}:{}),...(reference?{id:reference}:{})})+'">Siguiente</a>':''));}
const uiHeaders={...sec,"Content-Security-Policy":"default-src 'none'; img-src 'self'; style-src 'self'; font-src 'self'; script-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'","Referrer-Policy":"same-origin"};
function uiHtml(value,status=200){return new Response(value,{status,headers:{...uiHeaders,"Content-Type":"text/html; charset=utf-8"}});}
const randomHex=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("");
async function adminMerchant(req,env,actor,csrf,url,ui){
 if(!ui||typeof ui.template!=="string")throw fail(503,"UI_NOT_PACKAGED");
 const prefix="/admin/assets/",home="/admin/merchant";
 if(req.method==="GET"&&url.pathname.startsWith(prefix)){
  const path=url.pathname.slice(prefix.length);
  if(path==="merchant-registration.css")return new Response(privateStyle+privateAdminStyle,{headers:{...sec,"Content-Type":"text/css; charset=utf-8"}});
  if(path==="merchant-territory.js")return new Response(territoryScript,{headers:{...sec,"Content-Type":"text/javascript; charset=utf-8"}});
  const asset=ui.assets?.[path];if(!asset||!Object.hasOwn(ui.assets,path))throw fail(404,"NOT_FOUND");
  const bytes=Uint8Array.from(atob(asset.base64),c=>c.charCodeAt(0));return new Response(bytes,{headers:{...sec,"Content-Type":asset.type}});
 }
 const view=createRegistrationRenderer({shell:createRegistrationShell(ui.template,home,prefix,prefix+"merchant-registration.css"),localPath:home,routeBase:home,scriptPath:prefix+"merchant-territory.js",csrf});
 if(req.method==="GET"&&url.pathname===home)return uiHtml(view.form());
 if(req.method!=="POST"||![home+"/confirm",home+"/edit",home+"/submit"].includes(url.pathname))throw fail(404,"NOT_FOUND");
 const data=await body(req,"application/x-www-form-urlencoded");
 if(data.csrf!==csrf)throw fail(403,"CSRF");
 delete data.csrf;
 const at=Date.now();
 if(url.pathname===home+"/confirm"){
  let input;try{input=validateRegistrationForm(data);}catch(e){return uiHtml(view.form({},e.message),400);}
  await env.DB.prepare("DELETE FROM merchant_drafts WHERE expires_at<=? AND EXISTS (SELECT 1 FROM merchant_runtime WHERE id=1 AND environment='staging' AND intake_enabled=0 AND notification_enabled=0 AND activation_enabled=0)").bind(at).run();
  const key=randomHex(),keyHash=await digest(key),requestKey=randomHex();
  const created=await env.DB.prepare("INSERT INTO merchant_drafts(key_hash,actor_id,request_key,payload_json,expires_at) SELECT ?,?,?,?,? WHERE (SELECT count(*) FROM merchant_drafts)<64 AND EXISTS (SELECT 1 FROM merchant_runtime WHERE id=1 AND environment='staging' AND intake_enabled=0 AND notification_enabled=0 AND activation_enabled=0) RETURNING key_hash").bind(keyHash,actor,requestKey,JSON.stringify(input),at+900000).first();
  if(created?.key_hash!==keyHash)throw fail(429,"DRAFT_CAPACITY");
  return uiHtml(view.confirmation(input,key));
 }
 if(!exact(data,["draft"])||typeof data.draft!=="string"||!/^[a-f0-9]{64}$/.test(data.draft))throw fail(400,"DRAFT_EXPIRED");
 const keyHash=await digest(data.draft),draft=await env.DB.prepare("SELECT request_key,payload_json,receipt_id FROM merchant_drafts WHERE key_hash=? AND actor_id=? AND expires_at>?").bind(keyHash,actor,at).first();
 if(!draft)throw fail(400,"DRAFT_EXPIRED");
 if(draft.receipt_id)return uiHtml(view.received(draft.receipt_id));
 const input=JSON.parse(draft.payload_json);
 if(url.pathname===home+"/edit"){
  const deleted=await env.DB.prepare("DELETE FROM merchant_drafts WHERE key_hash=? AND actor_id=? AND expires_at>? AND receipt_id IS NULL RETURNING key_hash").bind(keyHash,actor,at).first();
  if(deleted?.key_hash!==keyHash)throw fail(409,"DRAFT_EXPIRED");
  return uiHtml(view.form({...input,email_confirm:input.email}));
 }
 const d=normalizeComplete(input);
 if(!d.business_name.startsWith("Synthetic ")||!d.email.endsWith(".invalid")||d.phone!=="+51900000000")throw fail(400,"SYNTHETIC_ONLY");
 const response=await persistRequest(env,d,{requestKey:draft.request_key,privacyVersion:"TEST-v3",environment:"staging"},{keyHash,actor});
 const result=await response.json();
 return uiHtml(view.received(result.id),response.status);
}

// Public assets are only the same allowlisted assets already packed for private UI.
function publicAsset(path,ui){
 if(path==="merchant-registration.css")return new Response(privateStyle,{headers:{...sec,"Content-Type":"text/css; charset=utf-8"}});
 if(path==="merchant-territory.js")return new Response(territoryScript,{headers:{...sec,"Content-Type":"text/javascript; charset=utf-8"}});
 const a=ui?.assets?.[path];if(!a||!Object.hasOwn(ui.assets,path))throw fail(404,"NOT_FOUND");
 return new Response(Uint8Array.from(atob(a.base64),c=>c.charCodeAt(0)),{headers:{...sec,"Content-Type":a.type}});
}
const publicCsp=uiHeaders["Content-Security-Policy"].replace("script-src 'self'","script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com");
const browserCookie=req=>{const m=(req.headers.get("Cookie")??"").match(/(?:^|;\s*)__Host-desset-merchant=([a-f0-9]{64})(?:;|$)/);return m?.[1]??null;};
async function publicMerchant(req,env,url,ui,fetcher){
 const s=await productionGate(env,"intake");
 if(!ui?.template||!env.TURNSTILE_SECRET||env.TURNSTILE_HOST!==url.hostname||!/^[A-Za-z0-9_-]{10,100}$/.test(env.TURNSTILE_SITE_KEY??"")||!env.INTAKE_LIMIT)throw fail(503,"UNAVAILABLE");
 const home="/registro-comercios.html",prefix="/merchant/assets/",base="/merchant";
 if(req.method==="GET"&&url.pathname.startsWith(prefix))return publicAsset(url.pathname.slice(prefix.length),ui);
 const ip=req.headers.get("CF-Connecting-IP");
 if(!ip||!(await env.INTAKE_LIMIT.limit({key:ip})).success)throw fail(429,"RATE_LIMIT");
 const cookie=browserCookie(req)||(req.method==="GET"?randomHex():null);
 if(!cookie)throw fail(403,"SESSION_REQUIRED");
 const actor="browser:"+await digest(cookie),csrf=await digest("merchant-public-v1:"+cookie);
 const view=createRegistrationRenderer({shell:createRegistrationShell(ui.template,home,prefix,prefix+"merchant-registration.css",true),localPath:home,routeBase:base,scriptPath:prefix+"merchant-territory.js",csrf,production:true,privacyUrl:env.PRIVACY_URL,siteKey:env.TURNSTILE_SITE_KEY});
 const render=(value,status=200)=>new Response(value,{status,headers:{...uiHeaders,"Content-Security-Policy":publicCsp,"Content-Type":"text/html; charset=utf-8","Set-Cookie":"__Host-desset-merchant="+cookie+"; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800"}});
 if(req.method==="GET"&&url.pathname===home)return render(view.form());
 if(req.method!=="POST"||![base+"/confirm",base+"/edit",base+"/submit"].includes(url.pathname))throw fail(404,"NOT_FOUND");
 const data=await body(req,"application/x-www-form-urlencoded");
 if(data.csrf!==csrf)throw fail(403,"CSRF");delete data.csrf;
 const at=Date.now();
 if(url.pathname===base+"/confirm"){
  const token=data["cf-turnstile-response"];delete data["cf-turnstile-response"];
  let input;try{input=validateRegistrationForm(data,{synthetic:false});}catch(e){return render(view.form({},e.message),400);}
  await turnstile(token,env,fetcher);
  await env.DB.prepare("DELETE FROM merchant_drafts WHERE expires_at<=? AND EXISTS (SELECT 1 FROM merchant_runtime WHERE id=1 AND environment='production' AND intake_enabled=1 AND privacy_version=? AND launch_authorization_ref=?)").bind(at,s.privacy_version,env.LAUNCH_AUTHORIZATION_REF).run();
  const key=randomHex(),keyHash=await digest(key),requestKey=randomHex();
  const result=await env.DB.prepare("INSERT INTO merchant_drafts(key_hash,actor_id,request_key,payload_json,expires_at) SELECT ?,?,?,?,? WHERE (SELECT count(*) FROM merchant_drafts WHERE actor_id=?)<4 AND (SELECT count(*) FROM merchant_drafts)<512 AND EXISTS (SELECT 1 FROM merchant_runtime WHERE id=1 AND environment='production' AND intake_enabled=1 AND privacy_version=? AND launch_authorization_ref=?) RETURNING key_hash").bind(keyHash,actor,requestKey,JSON.stringify({input,privacyVersion:s.privacy_version}),at+900000,actor,s.privacy_version,env.LAUNCH_AUTHORIZATION_REF).first();
  if(result?.key_hash!==keyHash)throw fail(429,"DRAFT_CAPACITY");
  return render(view.confirmation(input,key));
 }
 if(!exact(data,["draft"])||!/^[a-f0-9]{64}$/.test(data.draft??""))throw fail(400,"DRAFT_EXPIRED");
 const keyHash=await digest(data.draft);
 const d=await env.DB.prepare("SELECT request_key,payload_json,receipt_id FROM merchant_drafts WHERE key_hash=? AND actor_id=? AND expires_at>?").bind(keyHash,actor,at).first();
 if(!d)throw fail(400,"DRAFT_EXPIRED");if(d.receipt_id)return render(view.received(d.receipt_id));
 const payload=JSON.parse(d.payload_json);if(payload.privacyVersion!==s.privacy_version)throw fail(409,"PRIVACY_VERSION_CHANGED");
 if(url.pathname===base+"/edit"){
  const r=await env.DB.prepare("DELETE FROM merchant_drafts WHERE key_hash=? AND actor_id=? AND expires_at>? AND receipt_id IS NULL RETURNING key_hash").bind(keyHash,actor,at).first();
  if(!r)throw fail(409,"DRAFT_EXPIRED");return render(view.form({...payload.input,email_confirm:payload.input.email}));
 }
 const response=await persistRequest(env,normalizeComplete(payload.input),{requestKey:d.request_key,privacyVersion:s.privacy_version,environment:"production"},{keyHash,actor});
 return render(view.received((await response.json()).id),response.status);
}

async function multipart(req,max=5300000){
 const type=req.headers.get("content-type")??"";
 if(!type.startsWith("multipart/form-data;")||!req.body)throw fail(415,"CONTENT_TYPE");
 const reader=req.body.getReader(),chunks=[];let n=0;
 try{while(true){const {value,done}=await reader.read();if(done)break;n+=value.length;if(n>max){await reader.cancel();throw fail(413,"BODY_LIMIT");}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(n);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 try{const form=await new Response(bytes,{headers:{"Content-Type":type}}).formData();if(new Set(form.keys()).size!==[...form.keys()].length)throw Error();return form;}catch{throw fail(400,"INVALID_BODY");}
}
function evidencePage(id,data,csrf){
 const h=(n,v)=>'<input type="hidden" name="'+esc(n)+'" value="'+esc(v)+'">';
 const base=h("id",id)+h("csrf",csrf),c=data.configuration??{};
 const docs=data.documents.map(d=>'<article><h2>'+esc(d.kind)+'</h2><p>'+esc(d.status)+' | SHA-256: '+esc(d.sha256)+'</p><p><a href="/admin/document?id='+encodeURIComponent(d.id)+'">Descargar PDF como archivo</a></p>'+(d.status==="QUARANTINED"?'<form method="post" action="/admin/document-review">'+h("doc",d.id)+h("csrf",csrf)+'<label>Referencia de revisión documental y análisis de seguridad <input required name="evidence" maxlength="120"></label><button name="decision" value="VERIFIED">Verificar</button><button name="decision" value="REJECTED">Rechazar</button></form>':"")+'</article>').join("");
 return html('<p><a href="/admin?id='+encodeURIComponent(id)+'">Volver a solicitud</a></p><h2>Documentación y contrato firmado</h2><p>Los PDF se mantienen privados y en cuarentena hasta la revisión documental y de seguridad. No se muestran en línea. La carga de un contrato no implica que esté firmado válidamente.</p>'+docs+'<form method="post" action="/admin/document-upload" enctype="multipart/form-data">'+base+'<label>Tipo <select name="kind"><option value="RUC">RUC</option><option value="REPRESENTATION">Representación</option><option value="PERMIT">Permiso aplicable</option><option value="SIGNED_CONTRACT">Contrato firmado</option></select></label><label>PDF (máximo 5 MiB) <input required type="file" name="file" accept="application/pdf"></label><button>Cargar en cuarentena</button></form><h2>Configuración comercial</h2><form method="post" action="/admin/configuration">'+base+'<label>RUC <input required name="ruc" inputmode="numeric" maxlength="11" value="'+esc(c.ruc)+'"></label><label>Comisión en puntos básicos <input required type="number" name="commissionBps" min="0" max="1350" value="'+esc(c.commission_bps)+'"></label><label>Tiempo de preparación (minutos) <input required type="number" name="serviceMinutes" min="1" max="180" value="'+esc(c.service_minutes)+'"></label><label>Referencia de verificación de liquidaciones <input required name="payoutRef" maxlength="120" value="'+esc(c.payout_ref)+'"></label><label>Versión de términos comerciales <input required name="termsVersion" maxlength="120" value="'+esc(c.commercial_terms_version)+'"></label><label>Permisos adicionales <select name="permitsRequired"><option value="1">Requeridos</option><option value="0"'+(c.permits_required===0?" selected":"")+'>No requeridos (justificar en revisión)</option></select></label><button>Guardar configuración</button></form>');
}
async function evidenceRoutes(req,env,actor,csrf,url){
 const redirect=id=>new Response(null,{status:303,headers:{...sec,Location:"/admin/evidence?id="+encodeURIComponent(id)}});
 if(req.method==="GET"&&url.pathname==="/admin/evidence"){const id=url.searchParams.get("id");return evidencePage(id,await listEvidence(env,id),csrf);}
 if(req.method==="GET"&&url.pathname==="/admin/document"){const data=await downloadDocument(env,url.searchParams.get("id"));return new Response(data,{headers:{...sec,"Content-Type":"application/octet-stream","Content-Disposition":"attachment; filename=documento.pdf"}});}
 if(req.method==="POST"&&url.pathname==="/admin/document-upload"){const f=await multipart(req);if(f.get("csrf")!==csrf||[...f.keys()].some(k=>!["csrf","id","kind","file"].includes(k)))throw fail(403,"CSRF");const file=f.get("file");if(!file||typeof file.arrayBuffer!=="function")throw fail(400,"INVALID_DOCUMENT");await uploadDocument(env,actor,{id:f.get("id"),kind:f.get("kind"),bytes:new Uint8Array(await file.arrayBuffer())});return redirect(f.get("id"));}
 if(req.method==="POST"&&url.pathname==="/admin/document-review"){const b=await body(req,"application/x-www-form-urlencoded");if(b.csrf!==csrf||!exact(b,["csrf","doc","decision","evidence"]))throw fail(403,"CSRF");const r=await reviewDocument(env,actor,b);return redirect(r.request_id);}
 if(req.method==="POST"&&url.pathname==="/admin/configuration"){const b=await body(req,"application/x-www-form-urlencoded");if(b.csrf!==csrf||!exact(b,["csrf","id","ruc","commissionBps","serviceMinutes","payoutRef","termsVersion","permitsRequired"]))throw fail(403,"CSRF");for(const k of ["commissionBps","serviceMinutes","permitsRequired"]){if(!/^\d+$/.test(b[k]??""))throw fail(400,"INVALID_CONFIGURATION");b[k]=Number(b[k]);}await saveConfiguration(env,actor,b);return redirect(b.id);}
 throw fail(404,"NOT_FOUND");
}

async function profileRoutes(req,env,actor,csrf,url){
 const redirect=id=>new Response(null,{status:303,headers:{...sec,Location:"/admin/profile?id="+encodeURIComponent(id)}});
 if(req.method==="GET"&&url.pathname==="/admin/profile")return html(preparationPage(await getPreparation(env,url.searchParams.get("id")),csrf));
 if(req.method==="GET"&&url.pathname==="/admin/profile-media"){const r=await readProfileMedia(env,url.searchParams.get("id"),url.searchParams.get("media"));return new Response(r.bytes,{headers:{...sec,"Content-Type":r.mime}});}
 if(req.method==="POST"&&url.pathname==="/admin/profile-upload"){const f=await multipart(req,2200000);if(f.get("csrf")!==csrf||[...f.keys()].some(k=>!["csrf","id","file"].includes(k)))throw fail(403,"CSRF");const file=f.get("file");if(!file||typeof file.arrayBuffer!=="function")throw fail(400,"INVALID_IMAGE");await uploadProfileMedia(env,actor,f.get("id"),new Uint8Array(await file.arrayBuffer()));return redirect(f.get("id"));}
 if(req.method!=="POST")throw fail(404,"NOT_FOUND");
 const b=await body(req,"application/x-www-form-urlencoded");if(b.csrf!==csrf)throw fail(403,"CSRF");delete b.csrf;
 if(url.pathname==="/admin/contact"){if(!exact(b,["id","channel","outcome","notes"]))throw fail(400,"INVALID_FIELDS");await recordContact(env,actor,b);}
 else if(url.pathname==="/admin/profile-edit"){if(!exact(b,["id","version","operation","name","description","logo","productId","category","productName","productDescription","price","photo",...Array.from({length:7},(_,i)=>"open"+i),...Array.from({length:7},(_,i)=>"close"+i)]))throw fail(400,"INVALID_FIELDS");await editProfile(env,actor,b);}
 else if(url.pathname==="/admin/profile-review"){if(!exact(b,["id","version","decision","evidence"]))throw fail(400,"INVALID_FIELDS");await reviewProfile(env,actor,b);}
 else throw fail(404,"NOT_FOUND");return redirect(b.id);
}

// One-time code never in URL or database in plaintext. Same-origin POST + session cookie.
const acceptanceCookie=req=>(req.headers.get("Cookie")??"").match(/(?:^|;\s*)__Host-desset-conformidad=([a-f0-9]{64})(?:;|$)/)?.[1]??"";
const acceptanceHeaders={...sec,"Content-Security-Policy":"default-src 'none'; img-src 'self'; style-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'","Content-Type":"text/html; charset=utf-8"};
const acceptanceHtml=(content,status=200,cookie=null)=>new Response('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DESSET — Conformidad comercial</title><link rel="stylesheet" href="/conformidad/assets/styles-typography.css"><link rel="stylesheet" href="/conformidad/assets/merchant-registration.css"></head><body class="merchant-admin"><main><h1>DESSET — Conformidad comercial</h1>'+content+'</main></body></html>',{status,headers:{...acceptanceHeaders,...(cookie===null?{}:{"Set-Cookie":"__Host-desset-conformidad="+cookie+"; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age="+(cookie?1800:0)})}});
const hidden=(k,v)=>'<input type="hidden" name="'+esc(k)+'" value="'+esc(v)+'">';
async function merchantAcceptance(req,env,url,ui){
 await productionGate(env,"intake");
 if(req.method==="GET"&&url.pathname.startsWith("/conformidad/assets/")){const p=url.pathname.slice("/conformidad/assets/".length);if(p==="merchant-registration.css")return new Response(privateStyle+privateAdminStyle,{headers:{...sec,"Content-Type":"text/css; charset=utf-8"}});return publicAsset(p,ui);}
 const ip=req.headers.get("CF-Connecting-IP");if(!ip||!env.INTAKE_LIMIT||!(await env.INTAKE_LIMIT.limit({key:ip})).success)throw fail(429,"RATE_LIMIT");
 if(req.method==="GET"&&url.pathname==="/conformidad")return acceptanceHtml('<p>Introduce el código que te entregó el representante de DESSET para revisar tu información.</p><form method="post" action="/conformidad/abrir"><label>Código de acceso <input type="password" name="code" required maxlength="64" autocomplete="off"></label><button>Continuar</button></form>');
 if(req.method==="POST"&&url.pathname==="/conformidad/abrir"){const b=await body(req,"application/x-www-form-urlencoded");if(!exact(b,["code"]))throw fail(400,"INVALID_CODE");await acceptanceView(env,b.code);return new Response(null,{status:303,headers:{...sec,Location:"/conformidad/revisar","Set-Cookie":"__Host-desset-conformidad="+b.code+"; Path=/; Secure; HttpOnly; SameSite=Strict; Max-Age=1800"}});}
 const code=acceptanceCookie(req),a=await acceptanceView(env,code),csrf=await digest("conformidad-v1:"+code);
 if(req.method==="GET"&&url.pathname==="/conformidad/documento"&&a.purpose==="CONTRACT")return new Response(await downloadDocument(env,a.documentId),{headers:{...sec,"Content-Type":"application/octet-stream","Content-Disposition":"attachment; filename=contrato.pdf"}});
 if(req.method==="GET"&&url.pathname==="/conformidad/imagen"&&a.purpose==="PROFILE"){const mid=url.searchParams.get("id");if(![a.profile.logo,...a.profile.products.map(p=>p.photo)].filter(Boolean).includes(mid))throw fail(404,"NOT_FOUND");const m=await readProfileMedia(env,a.requestId,mid);return new Response(m.bytes,{headers:{...sec,"Content-Type":m.mime}});}
 if(req.method==="GET"&&url.pathname==="/conformidad/revisar"){
  const photo=id=>id?'<img src="/conformidad/imagen?id='+encodeURIComponent(id)+'" alt="" width="120" loading="lazy">':"";
  const content=a.purpose==="CONTRACT"?'<h2>Contrato comercial</h2><p>Versión de condiciones: '+esc(a.termsVersion)+'</p><p><a href="/conformidad/documento">Descargar contrato firmado</a></p><p>Confirma tu conformidad con el documento indicado. Esta confirmación no sustituye la firma del contrato.</p>':'<h2>Ficha comercial · versión '+a.profileVersion+'</h2><article>'+photo(a.profile.logo)+'<h3>'+esc(a.profile.name)+'</h3><p>'+esc(a.profile.description)+'</p>'+a.profile.hours.map((h,i)=>'<p>'+["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"][i]+': '+esc(h?h.open+"–"+h.close:"Cerrado")+'</p>').join("")+a.profile.products.map(p=>'<section><h3>'+esc(p.category)+' · '+esc(p.name)+'</h3>'+photo(p.photo)+'<p>'+esc(p.description)+'</p><p>S/ '+(p.priceCents/100).toFixed(2)+'</p></section>').join("")+'</article>';
  return acceptanceHtml(content+'<form method="post" action="/conformidad/decidir">'+hidden("csrf",csrf)+'<button name="decision" value="ACCEPTED">Confirmar conformidad</button><button name="decision" value="CORRECTIONS_REQUIRED">Solicitar correcciones</button></form>');
 }
 if(req.method==="POST"&&url.pathname==="/conformidad/decidir"){const b=await body(req,"application/x-www-form-urlencoded");if(!exact(b,["csrf","decision"])||b.csrf!==csrf)throw fail(403,"CSRF");const r=await decideAcceptance(env,code,b.decision);return acceptanceHtml('<p>'+ (r.decision==="ACCEPTED"?"Tu conformidad ha sido registrada.":"Tu solicitud de correcciones ha sido registrada.")+'</p><p>Referencia: '+esc(r.id)+'</p>',200,"");}
 throw fail(404,"NOT_FOUND");
}
async function adminAcceptance(req,env,actor,csrf,url){
 const base="/admin/conformidad";
 if(req.method==="GET"&&url.pathname===base){
  const id=url.searchParams.get("id"),rows=await listAcceptances(env,id),data=await listEvidence(env,id),h=hidden("id",id)+hidden("csrf",csrf);
  const docs=data.documents.filter(d=>d.kind==="SIGNED_CONTRACT"&&d.status==="VERIFIED");
  return html('<p><a href="/admin?id='+encodeURIComponent(id)+'">Volver a solicitud</a></p><h2>Conformidad del comercio</h2><p>Entrega el código personalmente por un canal de contacto previamente verificado. No se envía automáticamente.</p><form method="post" action="'+base+'/emitir">'+h+hidden("purpose","PROFILE")+'<label>Referencia de contacto verificado <input name="deliveryRef" required maxlength="120"></label><button>Generar código para ficha</button></form>'+(docs.length?'<form method="post" action="'+base+'/emitir">'+h+hidden("purpose","CONTRACT")+'<label>Contrato <select name="documentId">'+docs.map(d=>'<option value="'+esc(d.id)+'">'+esc(d.id)+'</option>').join("")+'</select></label><label>Referencia de contacto verificado <input name="deliveryRef" required maxlength="120"></label><button>Generar código para contrato</button></form>':"")+rows.map(r=>'<article><p>'+esc(r.purpose)+' · '+esc(r.decision??"Pendiente")+' · '+esc(r.id)+'</p>'+(!r.decision?'<form method="post" action="'+base+'/revocar">'+h+hidden("invitationId",r.id)+'<button>Revocar código</button></form>':"")+'</article>').join(""));
 }
 if(req.method!=="POST")throw fail(404,"NOT_FOUND");
 const b=await body(req,"application/x-www-form-urlencoded");if(b.csrf!==csrf)throw fail(403,"CSRF");
 if(url.pathname===base+"/emitir"){if(!exact(b,["id","purpose","deliveryRef","documentId","csrf"]))throw fail(400,"INVALID_FIELDS");const r=await issueAcceptance(env,actor,b);return html('<h2>Código de acceso</h2><p><code>'+esc(r.code)+'</code></p><p>Válido durante 24 horas. Comparte el código únicamente por el canal verificado. No se mostrará de nuevo.</p><p>Acceso: /conformidad</p><p><a href="'+base+'?id='+encodeURIComponent(b.id)+'">Volver</a></p>');}
 if(url.pathname===base+"/revocar"){if(!exact(b,["id","invitationId","csrf"]))throw fail(400,"INVALID_FIELDS");await revokeAcceptance(env,b.invitationId,b.id);return new Response(null,{status:303,headers:{...sec,Location:base+"?id="+encodeURIComponent(b.id)}});}
 throw fail(404,"NOT_FOUND");
}

export async function handle(req,env,ctx,fetcher=fetch,now=Math.floor(Date.now()/1000),ui=null){
 try{const url=new URL(req.url),origin=originFor(env);if(url.origin!==origin||url.protocol!=="https:")throw fail(403,"HOST");
 if(req.method==="POST"&&(req.headers.get("Origin")!==origin||req.headers.get("Sec-Fetch-Site")==="cross-site"))throw fail(403,"ORIGIN");
 if(url.pathname==="/privacidad-comercios.html"&&req.method==="GET"){const p=await approvedPrivacyNotice(env);return new Response('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DESSET — Aviso de privacidad de comercios</title><main><h1>Aviso de privacidad de comercios</h1><p>Versión: '+esc(p.version)+'</p>'+p.text.split(/\\n/).filter(Boolean).map(x=>'<p>'+esc(x)+'</p>').join("")+'<p><a href="/registro-comercios.html">Volver a la solicitud</a></p></main></html>',{headers:{...sec,"Content-Type":"text/html; charset=utf-8"}});}
 if(url.pathname==="/conformidad"||url.pathname.startsWith("/conformidad/"))return await merchantAcceptance(req,env,url,ui);
 if(url.pathname==="/api/intake"){if(env.ENVIRONMENT!=="production")throw fail(503,"INTAKE_DISABLED");await productionGate(env,"intake");if(req.method!=="POST")throw fail(405,"METHOD");return await submit(req,env,fetcher);}
 if(url.pathname==="/registro-comercios.html"||url.pathname.startsWith("/merchant/")){if(env.ENVIRONMENT!=="production")throw fail(503,"INTAKE_DISABLED");return await publicMerchant(req,env,url,ui,fetcher); }
 if(url.pathname==="/admin"||url.pathname.startsWith("/admin/")){
 const {actor,csrf}=await authorize(req,env,ctx,fetcher,now);
 const runtime=await state(env);
 if(runtime.environment==="staging"&&(runtime.intake_enabled!==0||runtime.notification_enabled!==0||runtime.activation_enabled!==0))throw fail(503,"STAGING_NOT_ISOLATED");
 if(env.ENVIRONMENT==="production"&&(url.pathname==="/admin/merchant"||url.pathname.startsWith("/admin/merchant/")))throw fail(404,"NOT_FOUND");
 if(url.pathname==="/admin/merchant"||url.pathname.startsWith("/admin/merchant/")||url.pathname.startsWith("/admin/assets/"))return await adminMerchant(req,env,actor,csrf,url,ui);
 if(url.pathname==="/admin/conformidad"||url.pathname.startsWith("/admin/conformidad/"))return await adminAcceptance(req,env,actor,csrf,url);
 if(["/admin/profile","/admin/profile-media","/admin/profile-upload","/admin/contact","/admin/profile-edit","/admin/profile-review"].includes(url.pathname))return await profileRoutes(req,env,actor,csrf,url);
 if(["/admin/evidence","/admin/document","/admin/document-upload","/admin/document-review","/admin/configuration"].includes(url.pathname))return await evidenceRoutes(req,env,actor,csrf,url);
 if(req.method==="GET"&&(url.pathname==="/admin"||url.pathname==="/admin/api/requests")){const offset=Number(url.searchParams.get("offset")??0),status=url.searchParams.get("status")||null,reference=url.searchParams.get("id")||null,rows=await list(env,offset,status,reference);return url.pathname==="/admin"?panel(rows,offset,csrf,status,reference,env.ENVIRONMENT==="production"):json({requests:rows});}
 if(req.method==="GET"&&url.pathname==="/admin/api/history"){const id=url.searchParams.get("id");if(!uuid(id))throw fail(400,"INVALID_REFERENCE");return json({account:await accountHistory(env,id),notifications:await notificationHistory(env,id)});}
 if(req.method==="POST"&&url.pathname==="/admin/notification"){const b=await body(req,"application/x-www-form-urlencoded");if(!exact(b,["id","decision","evidence","providerMessageId","csrf"])||b.csrf!==csrf)throw fail(403,"CSRF");delete b.csrf;await reconcileNotification(env,actor,b);return new Response(null,{status:303,headers:{...sec,Location:"/admin"}});}
 if(req.method==="POST"&&url.pathname==="/admin/account"){const b=await body(req,"application/x-www-form-urlencoded");if(!exact(b,["id","from","to","version","reason","authorization","csrf"])||b.csrf!==csrf||!/^(0|[1-9][0-9]*)$/.test(b.version??""))throw fail(403,"CSRF");delete b.csrf;b.version=Number(b.version);if(b.to==="ACTIVE"&&env.ENVIRONMENT==="production")await productionGate(env,"activation");if(b.to!=="ACTIVE")delete b.authorization;await changeAccountStatus(env,actor,b);return new Response(null,{status:303,headers:{...sec,Location:"/admin"}});}
 if(req.method==="POST"&&url.pathname==="/admin/onboarding"){const b=await body(req,"application/x-www-form-urlencoded");if(!exact(b,["id","from","to","evidence","csrf"])||b.csrf!==csrf)throw fail(403,"CSRF");await advanceOnboarding(env,actor,{id:b.id,from:b.from,to:b.to,evidence:b.evidence});return new Response(null,{status:303,headers:{...sec,Location:"/admin"}});}
 if(req.method==="POST"&&url.pathname==="/admin/review"){const b=await body(req,"application/x-www-form-urlencoded");if(!exact(b,["id","decision","csrf"])||b.csrf!==csrf)throw fail(403,"CSRF");await review(env,actor,{id:b.id,decision:b.decision});return new Response(null,{status:303,headers:{...sec,Location:"/admin"}});}
 }
 return json({error:"NOT_FOUND"},404);
 }catch(e){return json({error:e.publicCode??"INTERNAL_ERROR"},e.status??500);}
}
// No provider idempotency guarantee assumed: ambiguous acceptance requires human reconciliation, never automatic duplicate delivery.
export async function notifyOne(env,at=Date.now()){
 if(env.ENVIRONMENT!=="production")return "DISABLED";
 let s;try{s=await productionGate(env,"notification");}catch(e){if(e.status===503)return "DISABLED";throw e;}
 if(env.NOTIFICATIONS_ENABLED!=="true"||s.notification_enabled!==1||!env.EMAIL||!env.NOTIFY_FROM||!env.NOTIFY_TO)return "DISABLED";
 await env.DB.prepare("UPDATE merchant_notification_outbox SET status='NEEDS_REVIEW',lease_token=NULL,lease_until=NULL WHERE status='SENDING' AND lease_until<=?").bind(at).run();
 const token=crypto.randomUUID();
 const r=await env.DB.prepare("UPDATE merchant_notification_outbox SET status='SENDING',attempts=attempts+1,lease_token=?,lease_until=? WHERE request_id=(SELECT request_id FROM merchant_notification_outbox WHERE status='PENDING' AND next_attempt_at<=? ORDER BY next_attempt_at,created_at,request_id LIMIT 1) AND status='PENDING' AND EXISTS (SELECT 1 FROM merchant_runtime WHERE id=1 AND notification_enabled=1 AND environment=? AND launch_authorization_ref=?) RETURNING request_id").bind(token,at+300000,at,s.environment,env.LAUNCH_AUTHORIZATION_REF).first();
 if(!r)return "EMPTY";
 // A gate closing before invocation is a known non-send; do not label it ambiguous.
 try{await productionGate(env,"notification");}catch(e){if(e.status!==503)throw e;const r2=await env.DB.prepare("UPDATE merchant_notification_outbox SET status='PENDING',attempts=attempts-1,lease_token=NULL,lease_until=NULL WHERE request_id=? AND status='SENDING' AND lease_token=?").bind(r.request_id,token).run();return r2.meta.changes===1?"DISABLED":"LEASE_LOST";}
 let messageId;try{const receipt=await env.EMAIL.send({from:env.NOTIFY_FROM,to:env.NOTIFY_TO,subject:"DESSET — Nueva solicitud de comercio",text:"Referencia: "+r.request_id+"\nRevise la solicitud en el panel privado de DESSET."});if(typeof receipt?.messageId==="string"&&receipt.messageId.length>0)messageId=receipt.messageId;}catch{/* Do not expose provider errors or retry an ambiguous delivery. */}
 const result=await env.DB.prepare("UPDATE merchant_notification_outbox SET status=?,lease_token=NULL,lease_until=NULL,sent_at=?,provider_message_id=? WHERE request_id=? AND status='SENDING' AND lease_token=?").bind(messageId?"SENT":"NEEDS_REVIEW",messageId?Date.now():null,messageId??null,r.request_id,token).run();
 return result.meta.changes===1?(messageId?"SENT":"NEEDS_REVIEW"):"LEASE_LOST";
}
// Bounded drain; staging never sends even if configuration flags are forged.
export async function scheduledNotifications(env){if(env.ENVIRONMENT!=="production")return {processed:0};let processed=0;for(let i=0;i<5;i++){const result=await notifyOne(env);if(["DISABLED","EMPTY","LEASE_LOST"].includes(result))break;processed++;}return {processed};}
export default {fetch(req,env,ctx){return handle(req,env,ctx);},scheduled(controller,env,ctx){ctx.waitUntil(scheduledNotifications(env));}};
