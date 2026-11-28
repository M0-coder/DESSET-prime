// Read-only alert envelope candidate. No destination, credentials, acknowledgement or transport.
const fail=()=>Object.assign(Error("ALERT_PREVIEW_UNAVAILABLE"),{status:503,code:"ALERT_PREVIEW_UNAVAILABLE"});
const codes=["INTAKE_FLAGS_DIFFER","CAPACITY_THRESHOLD","BACKLOG_AGE_THRESHOLD","EXPIRED_PENDING_PURGE"];
export async function previewAlert(env,slot){
 if(env.ENVIRONMENT!=="production"||env.CONTACT_ALERT_PREVIEW_ENABLED!=="true"||!env.CONTACT_DB||!Number.isSafeInteger(slot)||slot<0)throw fail();
 try{
  const row=await env.CONTACT_DB.prepare("SELECT slot,observed_at,deleted,expired_after,alert_mask FROM contact_maintenance_cycles WHERE slot=? AND deleted IS NOT NULL").bind(slot).first();
  if(!row||row.slot!==slot||!Number.isSafeInteger(row.observed_at)||row.observed_at<0||Math.floor(row.observed_at/300000)!==slot||!Number.isSafeInteger(row.deleted)||row.deleted<0||row.deleted>100||!Number.isSafeInteger(row.expired_after)||row.expired_after<0||!Number.isInteger(row.alert_mask)||row.alert_mask<0||row.alert_mask>15)throw fail();
  if(row.alert_mask===0)return {status:"NO_ALERT",envelope:null,deliveryAttempted:false};
  return {status:"PREVIEW_ONLY",envelope:{schema:"desset-contact-operations-v1",idempotencyKey:"contact-maintenance-v1:"+slot,observedAt:row.observed_at,codes:codes.filter((_,i)=>(row.alert_mask&(1<<i))!==0),expiredRemaining:row.expired_after,deleted:row.deleted},deliveryAttempted:false};
 }catch{throw fail();}
}
