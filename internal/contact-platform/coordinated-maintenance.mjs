// Atomic bounded maintenance candidate. No scheduler, transport or public route.
const fail=()=>Object.assign(Error("COORDINATED_MAINTENANCE_UNAVAILABLE"),{status:503,code:"COORDINATED_MAINTENANCE_UNAVAILABLE"});
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const windowMs=300000, journalCapacity=10000;
const codes=["INTAKE_FLAGS_DIFFER","CAPACITY_THRESHOLD","BACKLOG_AGE_THRESHOLD","EXPIRED_PENDING_PURGE"];
export async function coordinatedMaintenance(env,at,policy){
 if(!integer(at,0,Number.MAX_SAFE_INTEGER)||!policy||typeof policy.approvalRef!=="string"||!/^[A-Za-z0-9_.:-]{1,128}$/.test(policy.approvalRef)||!integer(policy.capacityPercent,1,100)||!integer(policy.oldestAgeMs,1,31536000000)||policy.maxBatches!==1||env.ENVIRONMENT!=="production"||env.CONTACT_OPERATIONS_ENABLED!=="true"||env.CONTACT_MAINTENANCE_ENABLED!=="true"||env.CONTACT_PURGE_ENABLED!=="true"||env.CONTACT_RETENTION_APPROVED!=="true"||env.CONTACT_MAINTENANCE_APPROVAL_REF!==policy.approvalRef||typeof env.CONTACT_CAPACITY!=="string"||!/^[1-9][0-9]{0,4}$/.test(env.CONTACT_CAPACITY)||!integer(Number(env.CONTACT_CAPACITY),1,10000)||!env.CONTACT_DB)throw fail();
 const db=env.CONTACT_DB,slot=Math.floor(at/windowMs),token=crypto.randomUUID(),capacity=Number(env.CONTACT_CAPACITY),config=env.CONTACT_INTAKE_ENABLED==="true"?1:0;
 try{
  // All writes and journal completion are in one D1 batch transaction.
  // Slot monotonicity prevents a missed historical interval from performing new work.
  const result=await db.batch([
   db.prepare("INSERT INTO contact_maintenance_cycles(slot,token,observed_at,policy_ref,capacity,capacity_percent,oldest_age_ms,expired_before) SELECT ?,?,?,?,?,?,?,(SELECT count(*) FROM contact_requests WHERE expires_at<=?) FROM contact_runtime WHERE id=1 AND environment='production' AND ? > coalesce((SELECT max(slot) FROM contact_maintenance_cycles),-1) AND (SELECT count(*) FROM contact_maintenance_cycles)<?").bind(slot,token,at,policy.approvalRef,capacity,policy.capacityPercent,policy.oldestAgeMs,at,slot,journalCapacity),
   db.prepare("DELETE FROM contact_requests WHERE id IN (SELECT id FROM contact_requests WHERE expires_at<=? ORDER BY expires_at,id LIMIT 100) AND EXISTS(SELECT 1 FROM contact_maintenance_cycles WHERE slot=? AND token=? AND deleted IS NULL)").bind(at,slot,token),
   db.prepare("UPDATE contact_maintenance_cycles SET expired_after=(SELECT count(*) FROM contact_requests WHERE expires_at<=?),deleted=expired_before-(SELECT count(*) FROM contact_requests WHERE expires_at<=?),alert_mask=(SELECT CASE WHEN intake_enabled<>? THEN 1 ELSE 0 END FROM contact_runtime WHERE id=1) + CASE WHEN (SELECT count(*) FROM contact_requests)*100>=capacity*capacity_percent THEN 2 ELSE 0 END + CASE WHEN EXISTS(SELECT 1 FROM contact_requests WHERE state='RECEIVED' AND expires_at>? AND created_at<=?-oldest_age_ms) THEN 4 ELSE 0 END + CASE WHEN EXISTS(SELECT 1 FROM contact_requests WHERE expires_at<=?) THEN 8 ELSE 0 END WHERE slot=? AND token=? AND deleted IS NULL").bind(at,at,config,at,at,at,slot,token),
   db.prepare("SELECT slot,token,observed_at,policy_ref,capacity,capacity_percent,oldest_age_ms,expired_before,expired_after,deleted,alert_mask FROM contact_maintenance_cycles WHERE slot=?").bind(slot)
  ]);
  if(result.length!==4||result.some(x=>x.success!==true))throw fail();
  const row=result[3].results?.[0];
  if(!row||row.policy_ref!==policy.approvalRef||row.capacity!==capacity||row.capacity_percent!==policy.capacityPercent||row.oldest_age_ms!==policy.oldestAgeMs||!integer(row.deleted,0,100)||!integer(row.alert_mask,0,15))throw fail();
  return {slot,observedAt:row.observed_at,replayed:row.token!==token,deleted:row.deleted,expiredBefore:row.expired_before,expiredAfter:row.expired_after,alerts:codes.filter((_,i)=>(row.alert_mask&(1<<i))!==0),deliveryAttempted:false};
 }catch{throw fail();}
}
