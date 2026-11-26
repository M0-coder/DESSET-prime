// Private evidence module: access and CSRF are enforced by the Worker caller.
const fail=(status,publicCode)=>Object.assign(Error(publicCode),{status,publicCode});
const uuid=v=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const ref=v=>typeof v==="string"&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{2,119}$/.test(v);
const kinds=new Set(["RUC","REPRESENTATION","PERMIT","SIGNED_CONTRACT"]);
async function state(env){
 const r=await env.DB?.prepare("SELECT environment,intake_enabled,notification_enabled,activation_enabled FROM merchant_runtime WHERE id=1").first();
 if(!r||r.environment!==env.ENVIRONMENT||!["production","staging"].includes(r.environment))throw fail(503,"UNAVAILABLE");
 if(r.environment==="staging"&&(r.intake_enabled!==0||r.notification_enabled!==0||r.activation_enabled!==0))throw fail(503,"STAGING_NOT_ISOLATED");return r;
}
async function approved(env,id){
 if(!uuid(id))throw fail(400,"INVALID_REFERENCE");await state(env);
 const r=await env.DB.prepare("SELECT r.id,n.stage FROM merchant_requests r JOIN merchant_onboarding n ON n.request_id=r.id WHERE r.id=? AND r.status='APPROVED'").bind(id).first();
 if(!r)throw fail(409,"NOT_APPROVED");return r;
}
function bucket(env){if(!env.DOCUMENTS||env.DOCUMENTS_ENVIRONMENT!==env.ENVIRONMENT)throw fail(503,"DOCUMENT_STORAGE_DISABLED");return env.DOCUMENTS;}
const digest=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),x=>x.toString(16).padStart(2,"0")).join("");
export async function uploadDocument(env,actor,{id,kind,bytes}){
 const r=await approved(env,id);if(!kinds.has(kind)||!actor||!(bytes instanceof Uint8Array)||bytes.length<8||bytes.length>5242880||new TextDecoder().decode(bytes.slice(0,5))!=="%PDF-")throw fail(400,"INVALID_DOCUMENT");
 // Staging only accepts a known synthetic PDF marker; a PDF header alone is not a malware scan.
 if(env.ENVIRONMENT==="staging"&&!new TextDecoder().decode(bytes).includes("DESSET-SYNTHETIC"))throw fail(400,"SYNTHETIC_ONLY");
 if(r.stage==="READY_FOR_ACTIVATION")throw fail(409,"EVIDENCE_LOCKED");
 const storage=bucket(env),doc=crypto.randomUUID(),key=env.ENVIRONMENT+"/"+id+"/"+doc+".pdf",sha256=await digest(bytes),at=Date.now();
 await storage.put(key,bytes,{httpMetadata:{contentType:"application/pdf"},customMetadata:{sha256}});
 try{
 const inserted=await env.DB.prepare("INSERT INTO merchant_documents(id,request_id,kind,object_key,sha256,size_bytes,uploaded_by,uploaded_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM merchant_onboarding WHERE request_id=? AND stage<>'READY_FOR_ACTIVATION') RETURNING id").bind(doc,id,kind,key,sha256,bytes.length,actor,at,id).first();
 if(!inserted)throw fail(409,"EVIDENCE_LOCKED");
 }catch(e){ // Do not erase an object if the D1 write might have committed.
  let existing;try{existing=await env.DB.prepare("SELECT id FROM merchant_documents WHERE id=?").bind(doc).first();}catch{throw e;}
  if(!existing)await storage.delete(key);throw e;
 }
 return {id:doc,kind,sha256,status:"QUARANTINED"};
}
export async function listEvidence(env,id){await approved(env,id);
 const docs=await env.DB.prepare("SELECT id,kind,sha256,size_bytes,status,uploaded_by,uploaded_at,reviewed_by,reviewed_at,review_ref FROM merchant_documents WHERE request_id=? ORDER BY uploaded_at,id").bind(id).all();
 const configuration=await env.DB.prepare("SELECT ruc,commission_bps,currency,service_minutes,payout_ref,commercial_terms_version,permits_required,actor_id,updated_at FROM merchant_configuration WHERE request_id=?").bind(id).first();
 return {documents:docs.results,configuration:configuration??null};
}
export async function downloadDocument(env,doc){
 if(!uuid(doc))throw fail(400,"INVALID_REFERENCE");await state(env);
 const row=await env.DB.prepare("SELECT object_key,sha256,size_bytes FROM merchant_documents WHERE id=?").bind(doc).first();if(!row)throw fail(404,"NOT_FOUND");
 const obj=await bucket(env).get(row.object_key);if(!obj||obj.size!==row.size_bytes)throw fail(503,"DOCUMENT_INTEGRITY");
 const bytes=new Uint8Array(await obj.arrayBuffer());if(await digest(bytes)!==row.sha256)throw fail(503,"DOCUMENT_INTEGRITY");return bytes;
}
export async function reviewDocument(env,actor,{doc,decision,evidence}){
 if(!uuid(doc)||!["VERIFIED","REJECTED"].includes(decision)||!ref(evidence)||!actor)throw fail(400,"INVALID_DOCUMENT_REVIEW");await state(env);
 if(env.ENVIRONMENT==="staging"&&!evidence.startsWith("SYNTHETIC-"))throw fail(400,"SYNTHETIC_ONLY");
 if(decision==="VERIFIED")await downloadDocument(env,doc);
 const r=await env.DB.prepare("UPDATE merchant_documents SET status=?,reviewed_by=?,reviewed_at=?,review_ref=? WHERE id=? AND status='QUARANTINED' AND EXISTS(SELECT 1 FROM merchant_onboarding n WHERE n.request_id=merchant_documents.request_id AND n.stage<>'READY_FOR_ACTIVATION') RETURNING id,request_id").bind(decision,actor,Date.now(),evidence,doc).first();
 if(!r)throw fail(409,"DOCUMENT_REVIEW_CONFLICT");return r;
}
function validRuc(ruc){if(typeof ruc!=="string"||!/^\d{11}$/.test(ruc))return false;const w=[5,4,3,2,7,6,5,4,3,2],sum=w.reduce((a,v,i)=>a+v*Number(ruc[i]),0);return (11-sum%11)%10===Number(ruc[10]);}
export async function saveConfiguration(env,actor,b){
 const r=await approved(env,b.id);
 if(!actor||!validRuc(b.ruc)||!Number.isInteger(b.commissionBps)||b.commissionBps<0||b.commissionBps>1350||!Number.isInteger(b.serviceMinutes)||b.serviceMinutes<1||b.serviceMinutes>180||!ref(b.payoutRef)||!ref(b.termsVersion)||![0,1].includes(b.permitsRequired))throw fail(400,"INVALID_CONFIGURATION");
 if(env.ENVIRONMENT==="staging"&&(!b.payoutRef.startsWith("SYNTHETIC-")||!b.termsVersion.startsWith("SYNTHETIC-")))throw fail(400,"SYNTHETIC_ONLY");
 if(["CONFIGURATION_VERIFIED","READY_FOR_ACTIVATION"].includes(r.stage))throw fail(409,"CONFIGURATION_LOCKED");
 const q=await env.DB.prepare("INSERT INTO merchant_configuration(request_id,ruc,commission_bps,currency,service_minutes,payout_ref,commercial_terms_version,permits_required,actor_id,updated_at) SELECT ?,?,?,'PEN',?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM merchant_onboarding WHERE request_id=? AND stage NOT IN ('CONFIGURATION_VERIFIED','READY_FOR_ACTIVATION')) ON CONFLICT(request_id) DO UPDATE SET ruc=excluded.ruc,commission_bps=excluded.commission_bps,service_minutes=excluded.service_minutes,payout_ref=excluded.payout_ref,commercial_terms_version=excluded.commercial_terms_version,permits_required=excluded.permits_required,actor_id=excluded.actor_id,updated_at=excluded.updated_at RETURNING request_id").bind(b.id,b.ruc,b.commissionBps,b.serviceMinutes,b.payoutRef,b.termsVersion,b.permitsRequired,actor,Date.now(),b.id).first();
 if(!q)throw fail(409,"CONFIGURATION_LOCKED");return {id:b.id};
}
// Internal service interface; not exposed as a public HTTP endpoint. No PII.
export async function merchantAccountSnapshot(env,id){
 if(!uuid(id))throw fail(400,"INVALID_REFERENCE");const s=await state(env);
 const r=await env.DB.prepare("SELECT a.request_id,a.status,a.version,c.currency,c.commission_bps,c.service_minutes,c.commercial_terms_version FROM merchant_accounts a JOIN merchant_configuration c ON c.request_id=a.request_id WHERE a.request_id=?").bind(id).first();
 if(!r)return null;return {schemaVersion:1,merchantId:r.request_id,status:r.status,version:r.version,enabled:s.environment==="production"&&r.status==="ACTIVE",currency:r.currency,commissionBps:r.commission_bps,serviceMinutes:r.service_minutes,termsVersion:r.commercial_terms_version};
}
