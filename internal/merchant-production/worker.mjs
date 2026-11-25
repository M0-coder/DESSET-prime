// MERCHANT-PRODUCTION-01. Cloudflare Worker candidate, not deployed.
// Explicit bindings and database flags must both be enabled by authorized operators.
const fields=["business_name","category","department","province","district","address","contact_name","phone","email"];
const categories=["restaurant","grocery","bakery","specialty","pharmacy","other"];
const sec={"Cache-Control":"no-store","Content-Security-Policy":"default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow"};
const fail=(status,code)=>Object.assign(new Error(code),{status,publicCode:code});
const json=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{...sec,"Content-Type":"application/json; charset=utf-8"}});
const html=(body,status=200)=>new Response('<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DESSET — Solicitudes privadas</title><main><h1>DESSET — Incorporación comercial</h1>'+body+'</main></html>',{status,headers:{...sec,"Content-Type":"text/html; charset=utf-8"}});
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const enc=new TextEncoder();
const digest=async v=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",enc.encode(v))),x=>x.toString(16).padStart(2,"0")).join("");
const validKey=v=>typeof v==="string"&&/^[A-Za-z0-9_-]{16,100}$/.test(v);
const uuid=v=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const exact=(obj,keys)=>obj&&typeof obj==="object"&&!Array.isArray(obj)&&Object.keys(obj).every(k=>keys.includes(k));
export function normalize(input){
 if(!exact(input,[...fields,"observations"]))throw fail(400,"INVALID_FIELDS");
 const data={};for(const k of fields){const v=input[k];if(typeof v!=="string"||!v.trim()||v.trim().length>200||/[\u0000-\u001f\u007f]/.test(v))throw fail(400,"INVALID_FIELD");data[k]=v.trim();}
 if(!categories.includes(data.category)||!/^\+51[0-9]{9}$/.test(data.phone)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))throw fail(400,"INVALID_CONTACT");
 data.email=data.email.toLowerCase();
 if(input.observations!==undefined){if(typeof input.observations!=="string"||input.observations.length>1000||/[\u0000-\u001f\u007f]/.test(input.observations))throw fail(400,"INVALID_FIELD");if(input.observations.trim())data.observations=input.observations.trim();}
 return data;
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
 const h=decode(parts[0]),p=decode(parts[1]);if(h.alg!=="RS256"||typeof h.kid!=="string"||h.crit||p.iss!==env.ACCESS_ISSUER||!Array.isArray(p.aud)||!p.aud.includes(env.ACCESS_AUD)||!Number.isSafeInteger(p.exp)||p.exp<=now||!Number.isSafeInteger(p.iat)||p.iat>now+30||(p.nbf!==undefined&&(!Number.isSafeInteger(p.nbf)||p.nbf>now))||typeof p.sub!=="string"||!env.ADMIN_SUBJECTS.split(",").map(x=>x.trim()).includes(p.sub)||!p.email||p.type!=="app")throw Error();
 const r=await fetcher(env.ACCESS_ISSUER+"/cdn-cgi/access/certs",{redirect:"error",signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error();
 const keys=(await r.json()).keys;if(!Array.isArray(keys))throw Error();const jwk=keys.find(k=>k.kid===h.kid&&k.kty==="RSA"&&(!k.alg||k.alg==="RS256"));if(!jwk)throw Error();
 const key=await crypto.subtle.importKey("jwk",jwk,{name:"RSASSA-PKCS1-v1_5",hash:"SHA-256"},false,["verify"]);
 if(!await crypto.subtle.verify("RSASSA-PKCS1-v1_5",key,bytes(parts[2]),enc.encode(parts[0]+"."+parts[1])))throw Error();
 return p.sub;
 }catch{throw fail(403,"ACCESS_DENIED");}
}
async function state(env){if(!env.DB)throw fail(503,"UNAVAILABLE");const s=await env.DB.prepare("SELECT environment,intake_enabled,notification_enabled,privacy_version FROM merchant_runtime WHERE id=1").first();if(!s||s.environment!==env.ENVIRONMENT||!["staging","production"].includes(s.environment))throw fail(503,"UNAVAILABLE");return s;}
export async function turnstile(token,env,fetcher=fetch){
 if(typeof token!=="string"||token.length<1||token.length>2048||!env.TURNSTILE_SECRET||!env.TURNSTILE_HOST)throw fail(400,"CHALLENGE_REQUIRED");
 let r;try{r=await fetcher("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({secret:env.TURNSTILE_SECRET,response:token}),redirect:"error",signal:AbortSignal.timeout(5000)});}catch{throw fail(503,"CHALLENGE_UNAVAILABLE");}
 if(!r.ok)throw fail(503,"CHALLENGE_UNAVAILABLE");const v=await r.json();if(v.success!==true||v.hostname!==env.TURNSTILE_HOST||v.action!=="merchant_intake")throw fail(403,"CHALLENGE_INVALID");
}
export async function submit(req,env){
 const s=await state(env);
 if(env.INTAKE_ENABLED!=="true"||s.intake_enabled!==1||!s.privacy_version||env.PRIVACY_VERSION!==s.privacy_version)throw fail(503,"INTAKE_DISABLED");
 if(!env.INTAKE_LIMIT||!req.headers.get("CF-Connecting-IP"))throw fail(503,"UNAVAILABLE");
 if(!(await env.INTAKE_LIMIT.limit({key:req.headers.get("CF-Connecting-IP")})).success)throw fail(429,"RATE_LIMIT");
 const b=await body(req,"application/json");if(!exact(b,["input","requestKey","privacyVersion","consent","turnstileToken"])||!validKey(b.requestKey)||b.consent!==true||b.privacyVersion!==s.privacy_version)throw fail(400,"INVALID_REQUEST");
 const d=normalize(b.input);
 if(s.environment==="staging"&&(!d.business_name.startsWith("Synthetic ")||!d.email.endsWith(".invalid")||d.phone!=="+51900000000"))throw fail(400,"SYNTHETIC_ONLY");
 await turnstile(b.turnstileToken,env);
 const hash=await digest(JSON.stringify([d,b.privacyVersion])),identity=await digest(JSON.stringify(["business_name","department","province","district","address"].map(k=>d[k].normalize("NFKC").toLowerCase().replace(/\s+/g," "))));
 const id=crypto.randomUUID(),at=Date.now();
 try{
 // The database trigger creates the outbox in the same statement. Runtime gate checked at write time.
 const result=await env.DB.prepare("INSERT INTO merchant_requests(id,request_key,payload_hash,identity_hash,business_name,category,department,province,district,address,contact_name,phone,email,observations,privacy_version,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM merchant_runtime WHERE id=1 AND environment=? AND intake_enabled=1 AND privacy_version=?) ON CONFLICT(request_key) DO NOTHING RETURNING id").bind(id,b.requestKey,hash,identity,...fields.map(k=>d[k]),d.observations??null,b.privacyVersion,at,s.environment,s.privacy_version).first();
 if(result?.id===id)return json({id,replayed:false},201);
 }catch(e){if(String(e.message).includes("UNIQUE constraint failed: merchant_requests.identity_hash"))throw fail(409,"REQUEST_CONFLICT");throw e;}
 const old=await env.DB.prepare("SELECT id,payload_hash FROM merchant_requests WHERE request_key=?").bind(b.requestKey).first();
 if(!old)throw fail(503,"INTAKE_DISABLED");if(old.payload_hash!==hash)throw fail(409,"REQUEST_CONFLICT");return json({id:old.id,replayed:true});
}
async function list(env,offset){if(!Number.isSafeInteger(offset)||offset<0||offset>1000000)throw fail(400,"INVALID_OFFSET");const r=await env.DB.prepare("SELECT r.id,r.business_name,r.category,r.department,r.province,r.district,r.address,r.contact_name,r.phone,r.email,r.observations,r.created_at,r.status,e.actor_id,e.created_at reviewed_at,o.status notification_status,o.attempts,o.provider_message_id FROM merchant_requests r JOIN merchant_notification_outbox o ON o.request_id=r.id LEFT JOIN merchant_review_events e ON e.request_id=r.id ORDER BY r.created_at,r.id LIMIT 50 OFFSET ?").bind(offset).all();return r.results;}
async function review(env,actor,b){if(!exact(b,["id","decision"])||!uuid(b.id)||!["APPROVED","REJECTED"].includes(b.decision))throw fail(400,"INVALID_DECISION");const r=await env.DB.prepare("UPDATE merchant_requests SET status=?,reviewed_by=?,reviewed_at=? WHERE id=? AND status='PENDING' RETURNING id").bind(b.decision,actor,Date.now(),b.id).first();if(r?.id!==b.id)throw fail(409,"NOT_PENDING");return {id:b.id,status:b.decision};}
function panel(rows,offset){return html('<p>Aprobar una solicitud no activa un comercio.</p>'+rows.map(r=>'<article><h2>'+esc(r.business_name)+'</h2><p>Referencia '+esc(r.id)+' · '+esc(r.status)+'</p><p>'+esc(r.category)+' | '+esc(r.department)+' / '+esc(r.province)+' / '+esc(r.district)+' · '+esc(r.address)+'</p><p>'+esc(r.contact_name)+' · '+esc(r.phone)+' · '+esc(r.email)+'</p><p>'+esc(r.observations)+'</p><p>Notificación: '+esc(r.notification_status)+' · Intentos: '+esc(r.attempts)+'</p><p>Revisión: '+esc(r.actor_id)+' · '+esc(r.reviewed_at)+'</p>'+(r.status==="PENDING"?'<form method="post" action="/admin/review"><input type="hidden" name="id" value="'+esc(r.id)+'"><button name="decision" value="APPROVED">Aprobar</button> <button name="decision" value="REJECTED">Rechazar</button></form>':'')+'</article>').join('')+(offset?'<a href="/admin?offset='+Math.max(0,offset-50)+'">Anterior</a> ':'')+(rows.length===50?'<a href="/admin?offset='+(offset+50)+'">Siguiente</a>':''));}
export async function handle(req,env){
 try{const url=new URL(req.url);if(!env.SERVICE_ORIGIN||url.origin!==env.SERVICE_ORIGIN||url.protocol!=="https:")throw fail(403,"HOST");
 if(req.method==="POST"&&req.headers.get("Origin")!==env.SERVICE_ORIGIN)throw fail(403,"ORIGIN");
 if(url.pathname==="/api/intake"&&req.method==="POST")return await submit(req,env);
 if(url.pathname==="/admin"||url.pathname.startsWith("/admin/")){
 const actor=await verifyAccess(req,env);await state(env);
 if(req.method==="GET"&&(url.pathname==="/admin"||url.pathname==="/admin/api/requests")){const offset=Number(url.searchParams.get("offset")??0),rows=await list(env,offset);return url.pathname==="/admin"?panel(rows,offset):json({requests:rows});}
 if(req.method==="POST"&&url.pathname==="/admin/review"){await review(env,actor,await body(req,"application/x-www-form-urlencoded"));return new Response(null,{status:303,headers:{...sec,Location:"/admin"}});}
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
export default {fetch:handle,async scheduled(controller,env){await notifyOne(env);}};
