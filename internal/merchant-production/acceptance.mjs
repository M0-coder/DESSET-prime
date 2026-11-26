// Merchant confirmation via a high-entropy, expiring code delivered by a representative
// through a previously verified contact channel. Not a digital certificate or identity provider.
import {downloadDocument} from "./evidence.mjs";
import {readProfileMedia} from "./profile.mjs";
const fail=(status,publicCode)=>Object.assign(Error(publicCode),{status,publicCode});
const uuid=v=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const ref=v=>typeof v==="string"&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{2,119}$/.test(v);
const hash=async v=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v))),b=>b.toString(16).padStart(2,"0")).join("");
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("");
async function runtime(env){
 const s=await env.DB?.prepare("SELECT environment,intake_enabled,notification_enabled,activation_enabled FROM merchant_runtime WHERE id=1").first();
 if(!s||s.environment!==env.ENVIRONMENT||!["production","staging"].includes(s.environment))throw fail(503,"UNAVAILABLE");
 if(s.environment==="staging"&&(s.intake_enabled!==0||s.notification_enabled!==0||s.activation_enabled!==0))throw fail(503,"STAGING_NOT_ISOLATED");
}
async function target(env,id,purpose,doc=null){
 await runtime(env);if(!uuid(id))throw fail(400,"INVALID_REFERENCE");
 const req=await env.DB.prepare("SELECT r.id,n.stage FROM merchant_requests r JOIN merchant_onboarding n ON n.request_id=r.id WHERE r.id=? AND r.status='APPROVED'").bind(id).first();
 if(!req||req.stage==="READY_FOR_ACTIVATION")throw fail(409,"EVIDENCE_LOCKED");
 if(purpose==="PROFILE"){
  const p=await env.DB.prepare("SELECT version,payload_json FROM merchant_profiles WHERE request_id=?").bind(id).first();
  if(!p)throw fail(409,"PROFILE_INCOMPLETE");
  const profile=JSON.parse(p.payload_json);
  if(!profile.name||!profile.products.length||!profile.hours.some(Boolean))throw fail(409,"PROFILE_INCOMPLETE");
  return {profileVersion:p.version,documentId:null,termsVersion:null,snapshotHash:await hash(p.payload_json),profile};
 }
 if(purpose!=="CONTRACT"||!uuid(doc))throw fail(400,"INVALID_REFERENCE");
 const d=await env.DB.prepare("SELECT d.id,d.sha256,c.commercial_terms_version FROM merchant_documents d JOIN merchant_configuration c ON c.request_id=d.request_id WHERE d.id=? AND d.request_id=? AND d.kind='SIGNED_CONTRACT' AND d.status='VERIFIED'").bind(doc,id).first();
 if(!d)throw fail(409,"EVIDENCE_REQUIRED");
 return {profileVersion:null,documentId:d.id,termsVersion:d.commercial_terms_version,snapshotHash:d.sha256};
}
export async function issueAcceptance(env,actor,b,at=Date.now()){
 if(!actor||!ref(b.deliveryRef))throw fail(400,"INVALID_REFERENCE");
 if(env.ENVIRONMENT==="staging"&&!b.deliveryRef.startsWith("SYNTHETIC-"))throw fail(400,"SYNTHETIC_ONLY");
 const s=await target(env,b.id,b.purpose,b.documentId),code=random(),id=crypto.randomUUID(),expires=at+86400000;
 const r=await env.DB.prepare("INSERT INTO merchant_acceptances(id,request_id,purpose,profile_version,document_id,snapshot_hash,terms_version,code_hash,issued_by,delivery_ref,created_at,expires_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM merchant_onboarding WHERE request_id=? AND stage<>'READY_FOR_ACTIVATION') AND (SELECT count(*) FROM merchant_acceptances WHERE request_id=? AND decision IS NULL AND expires_at>?)<5 RETURNING id").bind(id,b.id,b.purpose,s.profileVersion,s.documentId,s.snapshotHash,s.termsVersion,await hash(code),actor,b.deliveryRef,at,expires,b.id,b.id,at).first();
 if(!r)throw fail(409,"ACCEPTANCE_LIMIT");return {id,code,expires};
}
export async function acceptanceView(env,code,at=Date.now()){
 await runtime(env);if(typeof code!=="string"||!/^[a-f0-9]{64}$/.test(code))throw fail(404,"INVALID_CODE");
 const a=await env.DB.prepare("SELECT id,request_id,purpose,profile_version,document_id,snapshot_hash,terms_version FROM merchant_acceptances WHERE code_hash=? AND decision IS NULL AND expires_at>?").bind(await hash(code),at).first();
 if(!a)throw fail(404,"INVALID_CODE");
 const s=await target(env,a.request_id,a.purpose,a.document_id);
 if(s.snapshotHash!==a.snapshot_hash||s.profileVersion!==a.profile_version||s.termsVersion!==a.terms_version)throw fail(409,"ACCEPTANCE_STALE");
 return {id:a.id,requestId:a.request_id,purpose:a.purpose,...s};
}
export async function decideAcceptance(env,code,decision,at=Date.now()){
 if(!["ACCEPTED","CORRECTIONS_REQUIRED"].includes(decision))throw fail(400,"INVALID_DECISION");
 const a=await acceptanceView(env,code,at);
 if(decision==="ACCEPTED"){if(a.purpose==="CONTRACT")await downloadDocument(env,a.documentId);else for(const m of new Set([a.profile.logo,...a.profile.products.map(p=>p.photo)].filter(Boolean)))await readProfileMedia(env,a.requestId,m);}
 const q=await env.DB.prepare("UPDATE merchant_acceptances SET decision=?,decided_at=? WHERE id=? AND decision IS NULL AND expires_at>? AND EXISTS(SELECT 1 FROM merchant_onboarding WHERE request_id=? AND stage<>'READY_FOR_ACTIVATION') AND ((purpose='PROFILE' AND EXISTS(SELECT 1 FROM merchant_profiles p WHERE p.request_id=merchant_acceptances.request_id AND p.version=merchant_acceptances.profile_version)) OR (purpose='CONTRACT' AND EXISTS(SELECT 1 FROM merchant_documents d JOIN merchant_configuration c ON c.request_id=d.request_id WHERE d.id=merchant_acceptances.document_id AND d.request_id=merchant_acceptances.request_id AND d.status='VERIFIED' AND d.sha256=merchant_acceptances.snapshot_hash AND c.commercial_terms_version=merchant_acceptances.terms_version))) RETURNING id").bind(decision,at,a.id,at,a.requestId).first();
 if(!q)throw fail(409,"ACCEPTANCE_CONFLICT");return {id:a.id,decision};
}
export async function listAcceptances(env,id){
 await runtime(env);if(!uuid(id))throw fail(400,"INVALID_REFERENCE");
 return (await env.DB.prepare("SELECT id,purpose,profile_version,document_id,terms_version,delivery_ref,created_at,expires_at,decision,decided_at FROM merchant_acceptances WHERE request_id=? ORDER BY created_at DESC,id DESC LIMIT 100").bind(id).all()).results;
}
export async function revokeAcceptance(env,id,requestId,at=Date.now()){
 await runtime(env);if(!uuid(id)||!uuid(requestId))throw fail(400,"INVALID_REFERENCE");
 const r=await env.DB.prepare("UPDATE merchant_acceptances SET decision='REVOKED',decided_at=? WHERE id=? AND request_id=? AND decision IS NULL RETURNING id").bind(at,id,requestId).first();
 if(!r)throw fail(409,"ACCEPTANCE_CONFLICT");
}
