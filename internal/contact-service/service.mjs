// Synthetic-only server candidate. This module has no public listener or production adapter.
import {createHash,randomUUID} from "node:crypto";
export const categories=Object.freeze(["alianzas","inversion","marketing","prensa","instituciones","profesionales","legal","seguridad","otras"]);
export const ORIGIN="https://contact-preview.invalid";
const fail=(status,code)=>Object.assign(Error(code),{status,code});
const sha=v=>createHash("sha256").update(v).digest("hex");
const MAX_BYTES=12000,RETENTION=7*86400000;
const text=(v,max,required=true,multiline=false)=>{
 if(typeof v!=="string")throw fail(400,"INVALID_FIELD");
 const s=v.trim().normalize("NFC");
 if((required&&!s)||s.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(s)||(!multiline&&/[\r\n\t]/u.test(s)))throw fail(400,"INVALID_FIELD");
 return s;
};
const shape=(obj,keys)=>{if(!obj||typeof obj!=="object"||Array.isArray(obj)||Object.keys(obj).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(obj,k)))throw fail(400,"INVALID_FIELDS");};
export function normalize(input){
 shape(input,["category","person","email","organization","phone","subject","message","consent","privacyVersion","requestKey","challenge"]);
 if(!categories.includes(input.category)||input.consent!==true||input.privacyVersion!=="synthetic-v1"||!(/^[a-f0-9]{64}$/).test(input.requestKey??""))throw fail(400,"INVALID_REQUEST");
 const person=text(input.person,100),email=text(input.email,150).toLowerCase(),organization=text(input.organization,120,false),phone=text(input.phone,30,false);
 const subject=text(input.subject,120),message=text(input.message,2000,true,true);
 // Test data convention, not anonymization or proof of identity.
 if(!person.startsWith("Synthetic ")||!/^synthetic[0-9]+@example\.invalid$/.test(email)||(organization&&!organization.startsWith("Synthetic "))||(phone&&phone!=="+51900000000")||!subject.startsWith("Synthetic ")||!message.startsWith("Synthetic "))throw fail(400,"SYNTHETIC_ONLY");
 if((["seguridad","otras","profesionales"].includes(input.category)&&organization)||(!["prensa","alianzas","marketing","instituciones"].includes(input.category)&&phone))throw fail(400,"UNEXPECTED_FIELD");
 if(typeof input.challenge!=="string"||!input.challenge||input.challenge.length>2048)throw fail(400,"INVALID_CHALLENGE");
 return {category:input.category,person,email,organization,phone,subject,message,privacyVersion:input.privacyVersion,requestKey:input.requestKey,challenge:input.challenge};
}
async function readBody(req){
 if((req.headers.get("content-type")??"").split(";")[0].trim()!=="application/json"||!req.body)throw fail(415,"CONTENT_TYPE");
 const reader=req.body.getReader(),dec=new TextDecoder("utf-8",{fatal:true});let size=0,s="";
 try{while(true){const r=await reader.read();if(r.done)break;size+=r.value.byteLength;if(size>MAX_BYTES){await reader.cancel();throw fail(413,"BODY_LIMIT");}s+=dec.decode(r.value,{stream:true});}s+=dec.decode();return JSON.parse(s);}catch(e){if(e.status)throw e;throw fail(400,"INVALID_JSON");}finally{reader.releaseLock();}
}
const response=(data,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","X-Robots-Tag":"noindex, nofollow","Referrer-Policy":"no-referrer","Content-Security-Policy":"default-src 'none'; frame-ancestors 'none'; base-uri 'none'"}});
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const atomic=(db,fn)=>{db.exec("BEGIN IMMEDIATE");try{const result=fn();db.exec("COMMIT");return result;}catch(e){db.exec("ROLLBACK");throw e;}};
export function makeContactHandler({db,mode="closed",enabled=false,rateLimit,verifyChallenge,authorizeAdmin,now=Date.now}={}){
 // No production mode. All dependencies are explicit; no default allow.
 return async req=>{
 try{
  if(mode!=="synthetic-local"||enabled!==true||!db||typeof rateLimit!=="function"||typeof verifyChallenge!=="function"||typeof authorizeAdmin!=="function")throw fail(503,"DISABLED");
  const url=new URL(req.url),at=now();
  if(url.origin!==ORIGIN)throw fail(403,"HOST");
  if(req.method==="POST"&&(req.headers.get("Origin")!==ORIGIN||req.headers.get("Sec-Fetch-Site")==="cross-site"))throw fail(403,"ORIGIN");
  if(req.method==="POST"&&url.pathname==="/api/contact"){
   if(await rateLimit(req)!==true)throw fail(429,"RATE_LIMIT");
   const data=normalize(await readBody(req));
   if(await verifyChallenge(data.challenge,{hostname:"contact-preview.invalid",action:"contact_intake"})!==true)throw fail(403,"CHALLENGE");
   const {requestKey,challenge,...payload}=data,hash=sha(JSON.stringify(payload));
   const result=atomic(db,()=>{
    const old=db.prepare("SELECT id,payload_hash,expires_at FROM contact_requests WHERE request_key=?").get(requestKey);
    if(old){if(old.expires_at<=at||old.payload_hash!==hash)throw fail(409,"REQUEST_CONFLICT");return {id:old.id,replayed:true};}
    if(db.prepare("SELECT count(*) n FROM contact_requests WHERE expires_at>?").get(at).n>=500)throw fail(429,"CAPACITY");
    const id=randomUUID();
    db.prepare("INSERT INTO contact_requests(id,request_key,payload_hash,category,person,email,organization,phone,subject,message,privacy_version,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)").run(id,requestKey,hash,payload.category,payload.person,payload.email,payload.organization,payload.phone,payload.subject,payload.message,payload.privacyVersion,at,at+RETENTION);
    return {id,replayed:false};
   });
   return response(result,result.replayed?200:201);
  }
  if(url.pathname.startsWith("/admin/")){
   const actor=await authorizeAdmin(req);
   if(!actor||typeof actor.id!=="string"||!/^synthetic-admin-[a-z0-9-]{1,40}$/.test(actor.id)||!Array.isArray(actor.categories)||actor.categories.some(x=>!categories.includes(x)))throw fail(403,"ACCESS_DENIED");
   if(req.method==="GET"&&url.pathname==="/admin/queue"){
    const cat=url.searchParams.get("category");
    if(!actor.categories.includes(cat))throw fail(403,"ACCESS_DENIED");
    return response({items:db.prepare("SELECT id,category,state,version,created_at,expires_at FROM contact_requests WHERE category=? AND expires_at>? ORDER BY created_at,id LIMIT 100").all(cat,at)});
   }
   if(req.method==="GET"&&url.pathname.startsWith("/admin/request/")){
    const id=url.pathname.slice("/admin/request/".length);if(!uuid.test(id))throw fail(404,"NOT_FOUND");
    const row=db.prepare("SELECT id,category,person,email,organization,phone,subject,message,state,version,created_at,expires_at FROM contact_requests WHERE id=? AND expires_at>?").get(id,at);
    if(!row||!actor.categories.includes(row.category))throw fail(404,"NOT_FOUND");
    return response(row);
   }
   if(req.method==="POST"&&url.pathname==="/admin/transition"){
    if(typeof actor.csrf!=="string"||actor.csrf.length<32||req.headers.get("X-CSRF-Token")!==actor.csrf)throw fail(403,"CSRF");
    const b=await readBody(req);shape(b,["id","version","state"]);
    if(!uuid.test(b.id??"")||!Number.isSafeInteger(b.version)||b.version<0||!["IN_REVIEW","CLOSED"].includes(b.state))throw fail(400,"INVALID_REQUEST");
    return response(atomic(db,()=>{
     const row=db.prepare("SELECT category,state,version FROM contact_requests WHERE id=? AND expires_at>?").get(b.id,at);
     if(!row||!actor.categories.includes(row.category))throw fail(404,"NOT_FOUND");
     if(row.version!==b.version||!((row.state==="RECEIVED"&&b.state==="IN_REVIEW")||(row.state==="IN_REVIEW"&&b.state==="CLOSED")))throw fail(409,"INVALID_TRANSITION");
     db.prepare("UPDATE contact_requests SET state=?,version=version+1 WHERE id=? AND version=?").run(b.state,b.id,b.version);
     db.prepare("INSERT INTO contact_events VALUES(?,?,?,?,?,?)").run(b.id,b.version+1,actor.id,row.state,b.state,at);
     return {id:b.id,state:b.state,version:b.version+1};
    }));
   }
  }
  throw fail(404,"NOT_FOUND");
 }catch(e){return response({error:e.status?e.code:"UNAVAILABLE"},e.status??503);}
 };
}
// Internal maintenance only, no HTTP route. Synthetic retention is not an approved legal policy.
export function purgeSynthetic(db,at){if(!Number.isSafeInteger(at))throw Error("INVALID_TIME");return atomic(db,()=>db.prepare("DELETE FROM contact_requests WHERE expires_at<=?").run(at).changes);}
