// MERCHANT-PRODUCTION-01. Cloudflare Worker candidate, not deployed.
// Explicit bindings and database flags must both be enabled by authorized operators.
// MERCHANT-ACCESS-01: staging-only HTTP entrypoint; public intake and scheduled sending hard-disabled.
import {merchantFields as fields,validateMerchantInput} from "../merchant-common/validation.mjs";
import {resolveTerritory} from "../merchant-common/territory.mjs";
import {createRegistrationShell,createRegistrationRenderer,validateRegistrationForm,privateStyle,privateAdminStyle} from "../merchant-common/registration-view.mjs";
import {territoryScript} from "../merchant-common/location-ui.mjs";
export const STAGING_ORIGIN="https://desset-merchant-staging.morimil-pabfelon.workers.dev";
const sec={"Cache-Control":"no-store","Content-Security-Policy":"default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow"};
const fail=(status,code)=>Object.assign(new Error(code),{status,publicCode:code});
const json=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{...sec,"Content-Type":"application/json; charset=utf-8"}});
const html=(body,status=200)=>new Response('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DESSET — Solicitudes privadas</title><link rel="stylesheet" href="/admin/assets/styles-typography.css"><link rel="stylesheet" href="/admin/assets/merchant-registration.css"></head><body class="merchant-admin"><main><h1>DESSET — Incorporación comercial</h1>'+body+'</main></body></html>',{status,headers:{...sec,"Content-Security-Policy":"default-src \'none\'; style-src \'self\'; font-src \'self\'; form-action \'self\'; frame-ancestors \'none\'; base-uri \'none\'","Content-Type":"text/html; charset=utf-8"}});
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
 const s=await state(env);
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
 const gate=draft?"EXISTS (SELECT 1 FROM merchant_runtime WHERE id=1 AND environment='staging' AND intake_enabled=0 AND notification_enabled=0 AND activation_enabled=0) AND EXISTS (SELECT 1 FROM merchant_drafts WHERE key_hash=? AND actor_id=? AND request_key=? AND expires_at>? AND receipt_id IS NULL)":"EXISTS (SELECT 1 FROM merchant_runtime WHERE id=1 AND environment=? AND intake_enabled=1 AND privacy_version=?)";
 const gateArgs=draft?[draft.keyHash,draft.actor,b.requestKey,at]:[b.environment,b.privacyVersion];
 const result=await env.DB.prepare("INSERT INTO merchant_requests(id,request_key,payload_hash,identity_hash,business_name,category,department,province,district,address,contact_name,phone,email,observations,postal_code,interest_level,contact_pronunciation,ubigeo,privacy_version,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE "+gate+" ON CONFLICT(request_key) DO NOTHING RETURNING id").bind(id,b.requestKey,hash,identity,...fields.map(k=>d[k]),d.observations??null,d.postal_code,d.interest_level,d.contact_pronunciation??null,d.ubigeo,b.privacyVersion,at,...gateArgs).first();
 if(result?.id===id)return json({id,replayed:false},201);
 }catch(e){if(String(e.message).includes("UNIQUE constraint failed: merchant_requests.identity_hash"))throw fail(409,"REQUEST_CONFLICT");throw e;}
 const old=await env.DB.prepare("SELECT id,payload_hash FROM merchant_requests WHERE request_key=?").bind(b.requestKey).first();
 if(!old)throw fail(draft?409:503,draft?"DRAFT_EXPIRED":"INTAKE_DISABLED");if(old.payload_hash!==hash)throw fail(409,"REQUEST_CONFLICT");return json({id:old.id,replayed:true});
}
async function list(env,offset){if(!Number.isSafeInteger(offset)||offset<0||offset>1000000)throw fail(400,"INVALID_OFFSET");const r=await env.DB.prepare("SELECT r.id,r.business_name,r.category,r.department,r.province,r.district,r.address,r.contact_name,r.phone,r.email,r.observations,r.postal_code,r.interest_level,r.contact_pronunciation,r.ubigeo,r.created_at,r.status,e.actor_id,e.created_at reviewed_at,o.status notification_status,o.attempts,o.provider_message_id,n.stage onboarding_stage,n.evidence_ref onboarding_evidence FROM merchant_requests r JOIN merchant_notification_outbox o ON o.request_id=r.id LEFT JOIN merchant_review_events e ON e.request_id=r.id LEFT JOIN merchant_onboarding n ON n.request_id=r.id ORDER BY r.created_at,r.id LIMIT 50 OFFSET ?").bind(offset).all();return r.results;}
async function review(env,actor,b){if(!exact(b,["id","decision"])||!uuid(b.id)||!["APPROVED","REJECTED"].includes(b.decision))throw fail(400,"INVALID_DECISION");const r=await env.DB.prepare("UPDATE merchant_requests SET status=?,reviewed_by=?,reviewed_at=? WHERE id=? AND status='PENDING' RETURNING id").bind(b.decision,actor,Date.now(),b.id).first();if(r?.id!==b.id)throw fail(409,"NOT_PENDING");return {id:b.id,status:b.decision};}
const nextStage=Object.freeze({EVALUATION_APPROVED:"DOCUMENTATION_VERIFIED",DOCUMENTATION_VERIFIED:"CONTRACT_VERIFIED",CONTRACT_VERIFIED:"CONFIGURATION_VERIFIED",CONFIGURATION_VERIFIED:"READY_FOR_ACTIVATION"});
const stageLabels=Object.freeze({DOCUMENTATION_VERIFIED:"Verificar documentación",CONTRACT_VERIFIED:"Verificar contrato",CONFIGURATION_VERIFIED:"Verificar configuración",READY_FOR_ACTIVATION:"Preparar para autorización de activación"});
export async function advanceOnboarding(env,actor,b){
 if(!exact(b,["id","from","to","evidence"])||!uuid(b.id)||!Object.hasOwn(nextStage,b.from)||nextStage[b.from]!==b.to||typeof b.evidence!=="string"||!/^SYNTHETIC-[A-Za-z0-9_-]{3,80}$/.test(b.evidence)||typeof actor!=="string"||!actor.trim())throw fail(400,"INVALID_ONBOARDING");
 const runtime=await state(env);
 if(runtime.environment!=="staging"||runtime.intake_enabled!==0||runtime.notification_enabled!==0)throw fail(503,"STAGING_NOT_ISOLATED");
 const r=await env.DB.prepare("UPDATE merchant_onboarding SET stage=?,actor_id=?,evidence_ref=?,updated_at=? WHERE request_id=? AND stage=? AND EXISTS (SELECT 1 FROM merchant_requests WHERE id=? AND status='APPROVED') AND EXISTS (SELECT 1 FROM merchant_runtime WHERE id=1 AND environment='staging' AND intake_enabled=0 AND notification_enabled=0 AND activation_enabled=0) RETURNING stage").bind(b.to,actor,b.evidence,Date.now(),b.id,b.from,b.id).first();
 if(r?.stage!==b.to)throw fail(409,"ONBOARDING_CONFLICT");return {id:b.id,stage:b.to};
}
function onboardingForm(r,csrf){
 const next=nextStage[r.onboarding_stage];if(!next)return "";
 return '<form method="post" action="/admin/onboarding"><input type="hidden" name="id" value="'+esc(r.id)+'"><input type="hidden" name="from" value="'+esc(r.onboarding_stage)+'"><input type="hidden" name="to" value="'+esc(next)+'"><input type="hidden" name="csrf" value="'+esc(csrf)+'"><label>Referencia de evidencia sintética <input required name="evidence" pattern="SYNTHETIC-[A-Za-z0-9_-]{3,80}" maxlength="90"></label><button>'+esc(stageLabels[next])+'</button></form>';
}
function panel(rows,offset,csrf){return html('<p>Aprobar una solicitud no activa un comercio.</p><p><a href="/admin/merchant">Registrar solicitud de ensayo</a></p>'+rows.map(r=>'<article><h2>'+esc(r.business_name)+'</h2><p>Referencia '+esc(r.id)+' · '+esc(r.status)+'</p><p>'+esc(r.category)+' | '+esc(r.department)+' / '+esc(r.province)+' / '+esc(r.district)+' · '+esc(r.address)+'</p><p>'+esc(r.contact_name)+' · '+esc(r.phone)+' · '+esc(r.email)+'</p><p>'+esc(r.observations)+'</p><p>UBIGEO: '+esc(r.ubigeo)+' | CP: '+esc(r.postal_code)+' | Interés: '+esc(r.interest_level)+' | Pronunciación: '+esc(r.contact_pronunciation)+'</p><p>Incorporación: '+esc(r.onboarding_stage)+'</p><p>Notificación: '+esc(r.notification_status)+' · Intentos: '+esc(r.attempts)+'</p><p>Revisión: '+esc(r.actor_id)+' · '+esc(r.reviewed_at)+'</p>'+(r.status==="PENDING"?'<form method="post" action="/admin/review"><input type="hidden" name="id" value="'+esc(r.id)+'"><input type="hidden" name="csrf" value="'+esc(csrf)+'"><button name="decision" value="APPROVED">Aprobar</button> <button name="decision" value="REJECTED">Rechazar</button></form>':'')+onboardingForm(r,csrf)+'</article>').join('')+(offset?'<a href="/admin?offset='+Math.max(0,offset-50)+'">Anterior</a> ':'')+(rows.length===50?'<a href="/admin?offset='+(offset+50)+'">Siguiente</a>':''));}
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

export async function handle(req,env,ctx,fetcher=fetch,now=Math.floor(Date.now()/1000),ui=null){
 try{const url=new URL(req.url);if(env.ENVIRONMENT!=="staging"||env.SERVICE_ORIGIN!==STAGING_ORIGIN||url.origin!==STAGING_ORIGIN||url.protocol!=="https:")throw fail(403,"HOST");
 if(req.method==="POST"&&(req.headers.get("Origin")!==STAGING_ORIGIN||req.headers.get("Sec-Fetch-Site")==="cross-site"))throw fail(403,"ORIGIN");
 // No runtime flag or D1 mutation can open public intake in this release.
 if(url.pathname==="/api/intake")throw fail(503,"INTAKE_DISABLED");
 if(url.pathname==="/admin"||url.pathname.startsWith("/admin/")){
 const {actor,csrf}=await authorize(req,env,ctx,fetcher,now);
 const runtime=await state(env);
 if(runtime.environment!=="staging"||runtime.intake_enabled!==0||runtime.notification_enabled!==0||runtime.activation_enabled!==0)throw fail(503,"STAGING_NOT_ISOLATED");
 if(url.pathname==="/admin/merchant"||url.pathname.startsWith("/admin/merchant/")||url.pathname.startsWith("/admin/assets/"))return adminMerchant(req,env,actor,csrf,url,ui);
 if(req.method==="GET"&&(url.pathname==="/admin"||url.pathname==="/admin/api/requests")){const offset=Number(url.searchParams.get("offset")??0),rows=await list(env,offset);return url.pathname==="/admin"?panel(rows,offset,csrf):json({requests:rows});}
 if(req.method==="POST"&&url.pathname==="/admin/onboarding"){const b=await body(req,"application/x-www-form-urlencoded");if(!exact(b,["id","from","to","evidence","csrf"])||b.csrf!==csrf)throw fail(403,"CSRF");await advanceOnboarding(env,actor,{id:b.id,from:b.from,to:b.to,evidence:b.evidence});return new Response(null,{status:303,headers:{...sec,Location:"/admin"}});}
 if(req.method==="POST"&&url.pathname==="/admin/review"){const b=await body(req,"application/x-www-form-urlencoded");if(!exact(b,["id","decision","csrf"])||b.csrf!==csrf)throw fail(403,"CSRF");await review(env,actor,{id:b.id,decision:b.decision});return new Response(null,{status:303,headers:{...sec,Location:"/admin"}});}
 }
 return json({error:"NOT_FOUND"},404);
 }catch(e){return json({error:e.publicCode??"INTERNAL_ERROR"},e.status??500);}
}
// No provider idempotency guarantee assumed: ambiguous acceptance requires human reconciliation, never automatic duplicate delivery.
export async function notifyOne(env,at=Date.now()){
 const s=await state(env);
 if(env.NOTIFICATIONS_ENABLED!=="true"||s.notification_enabled!==1||!env.EMAIL||!env.NOTIFY_FROM||!env.NOTIFY_TO)return "DISABLED";
 await env.DB.prepare("UPDATE merchant_notification_outbox SET status='NEEDS_REVIEW',lease_token=NULL,lease_until=NULL WHERE status='SENDING' AND lease_until<=?").bind(at).run();
 const token=crypto.randomUUID();
 const r=await env.DB.prepare("UPDATE merchant_notification_outbox SET status='SENDING',attempts=attempts+1,lease_token=?,lease_until=? WHERE request_id=(SELECT request_id FROM merchant_notification_outbox WHERE status='PENDING' ORDER BY created_at,request_id LIMIT 1) AND status='PENDING' AND EXISTS (SELECT 1 FROM merchant_runtime WHERE id=1 AND notification_enabled=1 AND environment=?) RETURNING request_id").bind(token,at+300000,s.environment).first();
 if(!r)return "EMPTY";
 let messageId;try{const receipt=await env.EMAIL.send({from:env.NOTIFY_FROM,to:env.NOTIFY_TO,subject:"DESSET — Nueva solicitud de comercio",text:"Referencia: "+r.request_id+"\nRevise la solicitud en el panel privado de DESSET."});if(typeof receipt?.messageId==="string"&&receipt.messageId.length>0)messageId=receipt.messageId;}catch{/* Do not expose provider errors or retry an ambiguous delivery. */}
 const result=await env.DB.prepare("UPDATE merchant_notification_outbox SET status=?,lease_token=NULL,lease_until=NULL,sent_at=?,provider_message_id=? WHERE request_id=? AND status='SENDING' AND lease_token=?").bind(messageId?"SENT":"NEEDS_REVIEW",messageId?Date.now():null,messageId??null,r.request_id,token).run();
 return result.meta.changes===1?(messageId?"SENT":"NEEDS_REVIEW"):"LEASE_LOST";
}
// Deliberately no scheduled handler or public intake dispatch in this staging-only release.
export default {fetch(req,env,ctx){return handle(req,env,ctx);}};
