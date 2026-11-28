// Internal candidate only. No scheduled handler, transport, network or live route.
import {operationalSnapshot} from "./operations.mjs";
import {purgeExpired} from "./d1-store.mjs";
const fail=()=>Object.assign(Error("MAINTENANCE_UNAVAILABLE"),{status:503,code:"MAINTENANCE_UNAVAILABLE"});
const integer=(v,min,max)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const reference=v=>typeof v==="string"&&/^[A-Za-z0-9_.:-]{1,128}$/.test(v);
function policyCheck(policy){
 if(!policy||!reference(policy.approvalRef)||!integer(policy.capacityPercent,1,100)||!integer(policy.oldestAgeMs,1,365*86400000)||!integer(policy.maxBatches,1,3))throw fail();
}
// Fixed event codes, no personal fields, no destination, no actual delivery.
function alerts(s,p){
 const result=[];
 if(s.intakeDatabaseEnabled!==s.intakeConfigurationEnabled)result.push("INTAKE_FLAGS_DIFFER");
 if(s.stored*100>=s.capacity*p.capacityPercent)result.push("CAPACITY_THRESHOLD");
 if(s.oldestReceivedAgeMs!==null&&s.oldestReceivedAgeMs>=p.oldestAgeMs)result.push("BACKLOG_AGE_THRESHOLD");
 if(s.expiredAwaitingPurge>0)result.push("EXPIRED_PENDING_PURGE");
 return result;
}
export async function maintenanceCycle(env,at,policy,mode="preview"){
 policyCheck(policy);
 if(env.CONTACT_MAINTENANCE_ENABLED!=="true"||env.CONTACT_OPERATIONS_ENABLED!=="true"||env.CONTACT_MAINTENANCE_APPROVAL_REF!==policy.approvalRef||!["preview","purge"].includes(mode))throw fail();
 // The approval ref is a contract guard, not evidence of actual approval.
 const before=await operationalSnapshot(env,at);
 if(mode==="purge"&&(env.CONTACT_PURGE_ENABLED!=="true"||env.CONTACT_RETENTION_APPROVED!=="true"))throw fail();
 let deleted=0,batches=0;
 if(mode==="purge"){
  while(batches<policy.maxBatches){
   const n=await purgeExpired(env.CONTACT_DB,at);batches++;deleted+=n;
   if(n<100)break;
  }
 }
 const after=mode==="preview"?before:await operationalSnapshot(env,at);
 return {mode,observedAt:at,batches,deleted,expiredBefore:before.expiredAwaitingPurge,expiredAfter:after.expiredAwaitingPurge,alertsBefore:alerts(before,policy),alertsAfter:alerts(after,policy),deliveryAttempted:false};
}
// Concurrent invocations may each run up to the bound; no global lease or scheduled execution is implemented.
