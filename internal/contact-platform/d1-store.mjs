// D1 binding API, primary database operations; no node:sqlite in the Worker.
const fail=(status,code)=>Object.assign(Error(code),{status,code});
const digest=async s=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s))),b=>b.toString(16).padStart(2,"0")).join("");
import {categories,uuid,normalizeContact} from "./contact-contract.mjs";
export {categories,uuid,normalizeContact};
const ref=v=>typeof v==="string"&&/^[A-Za-z0-9_.:-]{1,128}$/.test(v);
const validTime=v=>Number.isSafeInteger(v)&&v>=0;
function actorCheck(actor){
 if(!actor||!ref(actor.actor)||!Array.isArray(actor.categories)||!actor.categories.length||actor.categories.some(c=>!categories.includes(c)))throw fail(403,"ACCESS_DENIED");
}
// Exact fictional fixture vocabulary, never accepted as a staging substitute for real submissions.
export function isSyntheticContact(data){
 return data.person==="Synthetic Person"&&/^synthetic[0-9]+@example\.invalid$/.test(data.email)&&data.subject==="Synthetic subject"&&data.message==="Synthetic message"&&["","Synthetic Organization"].includes(data.organization)&&["","+51900000000"].includes(data.phone);
}
export async function receive(db,data,policy,at,environment="production"){
 if(!["production","staging"].includes(environment)||(environment==="staging"&&!isSyntheticContact(data)))throw fail(400,"INVALID_ENVIRONMENT");
 if(!validTime(at)||!Number.isInteger(policy.retentionDays)||policy.retentionDays<1||policy.retentionDays>365||!Number.isInteger(policy.capacity)||policy.capacity<1||policy.capacity>10000)throw fail(503,"POLICY_REQUIRED");
 const {requestKey,challenge,...payload}=data;
 if(payload.privacyVersion!==policy.privacyVersion)throw fail(409,"PRIVACY_CHANGED");
 const hash=await digest(JSON.stringify({...payload,privacySha256:policy.privacySha256,authorizationRef:policy.authorizationRef})),id=crypto.randomUUID(),expiry=at+policy.retentionDays*86400000;
 // Conditional write and replay lookup in one D1 transaction. Check kill switch at the write boundary.
 const stmt=db.prepare("INSERT INTO contact_requests(id,request_key,payload_hash,category,person,email,organization,phone,subject,message,privacy_version,privacy_sha256,authorization_ref,created_at,expires_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM contact_runtime WHERE id=1 AND environment=? AND intake_enabled=1 AND privacy_version=? AND privacy_sha256=? AND authorization_ref=?) AND (SELECT count(*) FROM contact_requests)< ? ON CONFLICT(request_key) DO NOTHING").bind(id,requestKey,hash,payload.category,payload.person,payload.email,payload.organization,payload.phone,payload.subject,payload.message,policy.privacyVersion,policy.privacySha256,policy.authorizationRef,at,expiry,environment,policy.privacyVersion,policy.privacySha256,policy.authorizationRef,policy.capacity);
 const lookup=db.prepare("SELECT id,payload_hash,expires_at FROM contact_requests WHERE request_key=? AND EXISTS(SELECT 1 FROM contact_runtime WHERE id=1 AND environment=? AND intake_enabled=1 AND privacy_version=? AND privacy_sha256=? AND authorization_ref=?)").bind(requestKey,environment,policy.privacyVersion,policy.privacySha256,policy.authorizationRef);
 const runtime=db.prepare("SELECT intake_enabled FROM contact_runtime WHERE id=1 AND environment=? AND privacy_version=? AND privacy_sha256=? AND authorization_ref=?").bind(environment,policy.privacyVersion,policy.privacySha256,policy.authorizationRef);
 const results=await db.batch([stmt,lookup,runtime]);
 if(results.length!==3||results.some(x=>x.success!==true))throw fail(503,"UNAVAILABLE");
 if(results[2].results?.[0]?.intake_enabled!==1)throw fail(503,"CONTACT_DISABLED");
 const row=results[1].results?.[0];
 if(!row)throw fail(429,"CAPACITY");
 if(row.expires_at<=at||row.payload_hash!==hash)throw fail(409,"REQUEST_CONFLICT");
 return {id:row.id,replayed:row.id!==id};
}
export async function queue(db,actor,category,at){
 actorCheck(actor);if(!actor.categories.includes(category))throw fail(403,"ACCESS_DENIED");
 const r=await db.prepare("SELECT id,category,state,version,created_at,expires_at FROM contact_requests WHERE category=? AND expires_at>? ORDER BY created_at,id LIMIT 100").bind(category,at).all();
 if(r.success!==true)throw fail(503,"UNAVAILABLE");return r.results;
}
// Keyset pagination uses immutable (created_at,id), not offsets or mutable state.
// Cursor is a position only, never an authorization token. Each page rechecks the department and expiry.
export async function queuePage(db,actor,category,at,cursor=null){
 actorCheck(actor);if(!actor.categories.includes(category))throw fail(403,"ACCESS_DENIED");
 if(!validTime(at))throw fail(400,"INVALID_TIME");
 let afterTime=0,afterId="";
 if(cursor!==null){
  if(typeof cursor!=="string"||cursor.length>80)throw fail(400,"INVALID_CURSOR");
  const match=/^(0|[1-9][0-9]{0,15}):([a-f0-9-]{36})$/.exec(cursor);
  if(!match||!validTime(Number(match[1]))||!uuid.test(match[2])||Number(match[1])>at)throw fail(400,"INVALID_CURSOR");
  afterTime=Number(match[1]);afterId=match[2];
 }
 const r=await db.prepare("SELECT id,category,state,version,created_at,expires_at FROM contact_requests WHERE category=? AND expires_at>? AND created_at<=? AND (created_at>? OR (created_at=? AND id>?)) ORDER BY created_at,id LIMIT 101").bind(category,at,at,afterTime,afterTime,afterId).all();
 if(r.success!==true||!Array.isArray(r.results)||r.results.length>101||r.results.some(x=>typeof x.id!=="string"||!uuid.test(x.id)||x.category!==category||!validTime(x.created_at)||x.created_at>at||x.expires_at<=at))throw fail(503,"UNAVAILABLE");
 const items=r.results.slice(0,100),last=items.at(-1);
 return {items,nextCursor:r.results.length===101?last.created_at+":"+last.id:null};
}
export async function detail(db,actor,id,at){
 actorCheck(actor);if(!uuid.test(id??""))throw fail(404,"NOT_FOUND");
 const r=await db.prepare("SELECT id,category,person,email,organization,phone,subject,message,state,version,created_at,expires_at FROM contact_requests WHERE id=? AND expires_at>? AND category IN (SELECT value FROM json_each(?))").bind(id,at,JSON.stringify(actor.categories)).first();
 if(!r)throw fail(404,"NOT_FOUND");return r;
}
export async function transition(db,actor,input,at){
 actorCheck(actor);
 if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).length!==3||!uuid.test(input.id??"")||!Number.isSafeInteger(input.version)||input.version<0||!["IN_REVIEW","CLOSED"].includes(input.state)||!validTime(at))throw fail(400,"INVALID_REQUEST");
 const from=input.state==="IN_REVIEW"?"RECEIVED":"IN_REVIEW";
 const r=await db.prepare("UPDATE contact_requests SET state=?,version=version+1,last_actor=?,last_transition_at=? WHERE id=? AND version=? AND state=? AND expires_at>? AND category IN (SELECT value FROM json_each(?)) RETURNING id,state,version").bind(input.state,actor.actor,at,input.id,input.version,from,at,JSON.stringify(actor.categories)).first();
 // The schema's AFTER UPDATE trigger atomically records the audit event or aborts the whole update.
 if(!r){await detail(db,actor,input.id,at);throw fail(409,"INVALID_TRANSITION");}return r;
}
export async function purgeExpired(db,at){
 if(!validTime(at))throw fail(400,"INVALID_TIME");
 // D1 meta.changes can include rows deleted by foreign-key cascades. Count only returned request IDs.
 const r=await db.prepare("DELETE FROM contact_requests WHERE id IN (SELECT id FROM contact_requests WHERE expires_at<=? ORDER BY expires_at,id LIMIT 100) RETURNING id").bind(at).all();
 if(r.success!==true||!Array.isArray(r.results)||r.results.length>100||r.results.some(x=>typeof x.id!=="string"))throw fail(503,"UNAVAILABLE");return r.results.length;
}
