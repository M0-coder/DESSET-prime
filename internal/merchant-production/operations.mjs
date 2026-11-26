// D1 operations. Authentication belongs to the caller (Worker verifies native Access + JWT).
// No public route, no real activation in staging, no automatic resend after uncertain acceptance.
const error=(status,publicCode)=>Object.assign(Error(publicCode),{status,publicCode});
const uuid=v=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const exact=(v,keys)=>v&&typeof v==="object"&&!Array.isArray(v)&&Object.keys(v).every(k=>keys.includes(k));
const reference=v=>typeof v==="string"&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{2,119}$/.test(v);
const actorOk=v=>typeof v==="string"&&v.length>0&&v.length<=200&&!/[\u0000-\u001f\u007f]/.test(v);
const syntheticRef=v=>reference(v)&&v.startsWith("SYNTHETIC-");
async function runtime(env){
 if(!env.DB)throw error(503,"UNAVAILABLE");
 const s=await env.DB.prepare("SELECT environment,intake_enabled,notification_enabled,activation_enabled FROM merchant_runtime WHERE id=1").first();
 if(!s||s.environment!==env.ENVIRONMENT||!["staging","production"].includes(s.environment))throw error(503,"UNAVAILABLE");
 if(s.environment==="staging"&&(s.intake_enabled!==0||s.notification_enabled!==0||s.activation_enabled!==0))throw error(503,"STAGING_NOT_ISOLATED");
 return s;
}
export async function reconcileNotification(env,actor,b,at=Date.now()){
 if(!actorOk(actor)||!exact(b,["id","decision","evidence","providerMessageId"])||!uuid(b.id)||!["CONFIRMED_SENT","CONFIRMED_NOT_SENT"].includes(b.decision)||!reference(b.evidence)||!Number.isSafeInteger(at)||at<0)throw error(400,"INVALID_RECONCILIATION");
 const sent=b.decision==="CONFIRMED_SENT";
 if(sent?!reference(b.providerMessageId):b.providerMessageId!==undefined&&b.providerMessageId!=="")throw error(400,"INVALID_PROVIDER_REFERENCE");
 const s=await runtime(env);
 if(s.environment==="staging"&&(!syntheticRef(b.evidence)||(sent&&!syntheticRef(b.providerMessageId))))throw error(400,"SYNTHETIC_ONLY");
 const row=await env.DB.prepare("SELECT attempts FROM merchant_notification_outbox WHERE request_id=? AND status='NEEDS_REVIEW'").bind(b.id).first();
 if(!row)throw error(409,"RECONCILIATION_CONFLICT");
 const retryAt=sent?0:at+Math.min(3600000,60000*2**Math.min(6,Math.max(0,row.attempts-1)));
 const id=crypto.randomUUID();
 try{
  const r=await env.DB.prepare("INSERT INTO merchant_notification_reconciliations(id,request_id,environment,decision,actor_id,evidence_ref,provider_message_id,created_at,retry_at) VALUES(?,?,?,?,?,?,?,?,?) RETURNING id").bind(id,b.id,s.environment,b.decision,actor,b.evidence,sent?b.providerMessageId:null,at,retryAt).first();
  if(r?.id!==id)throw error(409,"RECONCILIATION_CONFLICT");
 }catch(e){if(String(e.message).includes("RECONCILIATION_CONFLICT"))throw error(409,"RECONCILIATION_CONFLICT");throw e;}
 return {id:b.id,status:sent?"SENT":"PENDING",retryAt};
}
const transitions=Object.freeze({READY:["ACTIVE","DEACTIVATED"],ACTIVE:["SUSPENDED","DEACTIVATED"],SUSPENDED:["ACTIVE","DEACTIVATED"],DEACTIVATED:[]});
export async function changeAccountStatus(env,actor,b,at=Date.now()){
 if(!actorOk(actor)||!exact(b,["id","from","to","version","reason","authorization"])||!uuid(b.id)||!Object.hasOwn(transitions,b.from)||!transitions[b.from].includes(b.to)||!Number.isSafeInteger(b.version)||b.version<0||typeof b.reason!=="string"||b.reason.trim().length<4||b.reason.trim().length>300||/[\u0000-\u001f\u007f]/.test(b.reason)||!Number.isSafeInteger(at)||at<0)throw error(400,"INVALID_ACCOUNT_TRANSITION");
 const s=await runtime(env);
 if(s.environment==="staging"&&!b.reason.startsWith("SYNTHETIC-"))throw error(400,"SYNTHETIC_ONLY");
 const activating=b.to==="ACTIVE";
 if(activating&&(s.environment!=="production"||s.activation_enabled!==1||env.ACTIVATION_ENABLED!=="true"||env.COMMERCIAL_POLICY_VERIFIED!=="true"||!reference(env.ACTIVATION_AUTHORIZATION_REF)||b.authorization!==env.ACTIVATION_AUTHORIZATION_REF))throw error(503,"ACTIVATION_DISABLED");
 if(!activating&&b.authorization!==undefined&&b.authorization!=="")throw error(400,"UNEXPECTED_AUTHORIZATION");
 try{
  const r=await env.DB.prepare("UPDATE merchant_accounts SET status=?,version=version+1,actor_id=?,reason=?,authorization_ref=?,updated_at=? WHERE request_id=? AND status=? AND version=? AND EXISTS (SELECT 1 FROM merchant_runtime WHERE id=1 AND environment=? AND (?=0 OR (environment='production' AND activation_enabled=1))) RETURNING status,version").bind(b.to,actor,b.reason.trim(),activating?b.authorization:null,at,b.id,b.from,b.version,s.environment,activating?1:0).first();
  if(!r)throw error(409,"ACCOUNT_CONFLICT");return {id:b.id,status:r.status,version:r.version};
 }catch(e){if(String(e.message).includes("ACCOUNT_TRANSITION_DENIED"))throw error(409,"ACCOUNT_CONFLICT");throw e;}
}
export async function accountHistory(env,id){
 if(!uuid(id))throw error(400,"INVALID_REFERENCE");await runtime(env);
 const result=await env.DB.prepare("SELECT from_status,to_status,version,actor_id,reason,authorization_ref,created_at FROM merchant_account_events WHERE request_id=? ORDER BY version").bind(id).all();
 return result.results;
}
export async function notificationHistory(env,id){
 if(!uuid(id))throw error(400,"INVALID_REFERENCE");await runtime(env);
 const result=await env.DB.prepare("SELECT decision,actor_id,evidence_ref,provider_message_id,created_at,retry_at FROM merchant_notification_reconciliations WHERE request_id=? ORDER BY created_at,id").bind(id).all();
 return result.results;
}
