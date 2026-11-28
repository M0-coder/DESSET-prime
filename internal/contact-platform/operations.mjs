// Internal read-only operational snapshot candidate. Not connected to any public/admin route.
const fail=()=>Object.assign(Error("OPERATIONS_UNAVAILABLE"),{status:503,code:"OPERATIONS_UNAVAILABLE"});
const count=n=>Number.isSafeInteger(n)&&n>=0;
export async function operationalSnapshot(env,at){
 if(env.CONTACT_OPERATIONS_ENABLED!=="true"||env.ENVIRONMENT!=="production"||!env.CONTACT_DB||!Number.isSafeInteger(at)||at<0||typeof env.CONTACT_CAPACITY!=="string"||!/^[1-9][0-9]{0,4}$/.test(env.CONTACT_CAPACITY)||Number(env.CONTACT_CAPACITY)>10000)throw fail();
 const capacity=Number(env.CONTACT_CAPACITY);
 try{
  // One SQL statement gives a consistent snapshot, including rows awaiting physical purge.
  const row=await env.CONTACT_DB.prepare("SELECT r.intake_enabled AS intake, count(q.id) AS stored, coalesce(sum(CASE WHEN q.expires_at<=? THEN 1 ELSE 0 END),0) AS expired, coalesce(sum(CASE WHEN q.expires_at>? AND q.state='RECEIVED' THEN 1 ELSE 0 END),0) AS received, coalesce(sum(CASE WHEN q.expires_at>? AND q.state='IN_REVIEW' THEN 1 ELSE 0 END),0) AS reviewing, coalesce(sum(CASE WHEN q.expires_at>? AND q.state='CLOSED' THEN 1 ELSE 0 END),0) AS closed, min(CASE WHEN q.expires_at>? AND q.state='RECEIVED' THEN q.created_at ELSE NULL END) AS oldest FROM contact_runtime r LEFT JOIN contact_requests q ON 1=1 WHERE r.id=1 AND r.environment='production' GROUP BY r.id,r.intake_enabled").bind(at,at,at,at,at).first();
  if(!row||![0,1].includes(row.intake)||![row.stored,row.expired,row.received,row.reviewing,row.closed].every(count)||row.stored!==row.expired+row.received+row.reviewing+row.closed||(row.received===0?row.oldest!==null:!count(row.oldest)||row.oldest>at))throw fail();
  return {observedAt:at,intakeDatabaseEnabled:row.intake===1,intakeConfigurationEnabled:env.CONTACT_INTAKE_ENABLED==="true",stored:row.stored,expiredAwaitingPurge:row.expired,received:row.received,inReview:row.reviewing,closed:row.closed,capacity,capacityRemaining:Math.max(0,capacity-row.stored),oldestReceivedAgeMs:row.oldest===null?null:at-row.oldest};
 }catch{throw fail();}
}
