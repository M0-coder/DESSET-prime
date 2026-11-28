// Platform boundary candidate only. No Worker entrypoint or live intake.
import {authorizeRider} from "../rider-onboarding/access.mjs";
const fail=(status,code)=>Object.assign(Error(code),{status,code});
const categories=Object.freeze(["alianzas","inversion","marketing","prensa","instituciones","profesionales","legal","seguridad","otras"]);
const ref=v=>typeof v==="string"&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{2,119}$/.test(v);
const hex=v=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v);
const digest=async v=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v))),x=>x.toString(16).padStart(2,"0")).join("");
export const proposedOrigin="https://contacto.desset.lat";
export const productionScope=Object.freeze({environment:"production",origin:proposedOrigin});
export const stagingScope=Object.freeze({environment:"staging",origin:"https://contacto-staging.desset.lat"});
export function requireContactScope(scope){if(scope!==productionScope&&scope!==stagingScope)throw fail(503,"CONTACT_DISABLED");return scope;}
export async function intakePreflight(env,scope=productionScope){
 requireContactScope(scope);
 if(env.CONTACT_INTAKE_ENABLED!=="true"||env.CONTACT_POLICY_VERIFIED!=="true"||env.ENVIRONMENT!==scope.environment||env.CONTACT_ORIGIN!==scope.origin||!ref(env.CONTACT_AUTHORIZATION_REF)||!ref(env.CONTACT_PRIVACY_VERSION)||!hex(env.CONTACT_PRIVACY_SHA256)||typeof env.CONTACT_PRIVACY_NOTICE!=="string"||env.CONTACT_PRIVACY_NOTICE.trim().length<200||new TextEncoder().encode(env.CONTACT_PRIVACY_NOTICE).length>8000||await digest(env.CONTACT_PRIVACY_NOTICE)!==env.CONTACT_PRIVACY_SHA256||!env.CONTACT_DB||!env.CONTACT_LIMIT||!env.CONTACT_TURNSTILE_SECRET)throw fail(503,"CONTACT_DISABLED");
 const row=await env.CONTACT_DB.prepare("SELECT environment,intake_enabled,privacy_version,privacy_sha256,authorization_ref FROM contact_runtime WHERE id=1").first();
 if(!row||row.environment!==scope.environment||row.intake_enabled!==1||row.privacy_version!==env.CONTACT_PRIVACY_VERSION||row.privacy_sha256!==env.CONTACT_PRIVACY_SHA256||row.authorization_ref!==env.CONTACT_AUTHORIZATION_REF)throw fail(503,"CONTACT_DISABLED");
 return Object.freeze({privacyVersion:row.privacy_version,authorizationRef:row.authorization_ref});
}
export async function verifyContactChallenge(token,env,fetcher=fetch,scope=productionScope){
 requireContactScope(scope);
 if(typeof token!=="string"||!token||token.length>2048||typeof env.CONTACT_TURNSTILE_SECRET!=="string"||!env.CONTACT_TURNSTILE_SECRET||env.CONTACT_ORIGIN!==scope.origin)throw fail(403,"CHALLENGE_INVALID");
 try{
  const r=await fetcher("https://challenges.cloudflare.com/turnstile/v0/siteverify",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({secret:env.CONTACT_TURNSTILE_SECRET,response:token}),redirect:"error",signal:AbortSignal.timeout(5000)});
  if(!r.ok)throw Error();
  const v=await r.json();
  if(v.success!==true||v.hostname!==new URL(scope.origin).hostname||v.action!=="contact_intake")throw fail(403,"CHALLENGE_INVALID");
  return true;
 }catch(e){if(e.code==="CHALLENGE_INVALID")throw e;throw fail(503,"CHALLENGE_UNAVAILABLE");}
}
export async function limitContact(req,env){
 if(!env.CONTACT_LIMIT||typeof env.CONTACT_LIMIT.limit!=="function"||!hex(env.CONTACT_LIMIT_KEY))throw fail(503,"LIMIT_UNAVAILABLE");
 // Only call on trusted Cloudflare ingress after the origin gate; never use a caller-supplied X-Forwarded-For.
 const ip=req.headers.get("CF-Connecting-IP");
 if(!ip||ip.length>45||!/^[0-9a-f:.]+$/i.test(ip))throw fail(403,"INGRESS_REQUIRED");
 const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(env.CONTACT_LIMIT_KEY),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
 const sig=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(ip));
 const opaque=Array.from(new Uint8Array(sig),x=>x.toString(16).padStart(2,"0")).join("");
 const result=await env.CONTACT_LIMIT.limit({key:opaque});
 if(result?.success!==true)throw fail(429,"RATE_LIMIT");
 return true;
}
export async function authorizeContact(req,env,ctx,fetcher=fetch,now){
 // Reuse the existing verified JWT + trusted runtime identity pattern; no browser-declared actor.
 if(env.CONTACT_ADMIN_POLICY_VERIFIED!=="true")throw fail(503,"ADMIN_DISABLED");
 let roster;try{roster=JSON.parse(env.CONTACT_ADMIN_ROSTER??"[]");}catch{throw fail(503,"ADMIN_DISABLED");}
 if(!Array.isArray(roster)||!roster.length||roster.length>100||roster.some(a=>!a||typeof a.subject!=="string"||!/^[A-Za-z0-9_.:-]{1,128}$/.test(a.subject)||typeof a.email!=="string"||a.email.length>254||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(a.email)||!Array.isArray(a.categories)||!a.categories.length||new Set(a.categories).size!==a.categories.length||a.categories.some(c=>!categories.includes(c)))||new Set(roster.map(a=>a.subject)).size!==roster.length||new Set(roster.map(a=>a.email.toLowerCase())).size!==roster.length)throw fail(503,"ADMIN_DISABLED");
 if(!ctx?.access||typeof ctx.access.getIdentity!=="function"||ctx.access.aud!==env.CONTACT_ACCESS_AUD)throw fail(403,"ACCESS_CONTEXT_REQUIRED");
 // Snapshot the authenticated runtime identity once, not a caller-supplied header.
 let identity;try{identity=await ctx.access.getIdentity();}catch{throw fail(403,"ACCESS_DENIED");}
 if(typeof identity?.email!=="string"||!identity.email||identity.email.length>254)throw fail(403,"ACCESS_DENIED");
 const email=identity.email;
 const entry=roster.find(a=>a.email.toLowerCase()===email.toLowerCase());if(!entry)throw fail(403,"ACCESS_DENIED");
 const verified=await authorizeRider(req,{RIDER_ADMIN_POLICY_VERIFIED:"true",RIDER_ACCESS_ISSUER:env.CONTACT_ACCESS_ISSUER,RIDER_ACCESS_AUD:env.CONTACT_ACCESS_AUD,RIDER_ADMIN_SUBJECTS:entry.subject,RIDER_ADMIN_EMAIL:entry.email},{access:{aud:ctx.access.aud,getIdentity:async()=>({email})}},fetcher,now);
 if(verified.actor!==entry.subject)throw fail(403,"ACCESS_DENIED");
 // Separate CSRF namespace from the rider application.
 return {actor:verified.actor,categories:[...entry.categories],csrf:await digest("desset-contact-admin-v1:"+req.headers.get("Cf-Access-Jwt-Assertion"))};
}
