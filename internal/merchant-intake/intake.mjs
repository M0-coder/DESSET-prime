// Internal reference implementation. No HTTP endpoint, credentials, mail delivery or production activation.
import {createHash,randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
const fields=["business_name","category","department","province","district","address","contact_name","phone","email"];
const allowedCategories=new Set(["restaurant","grocery","bakery","specialty","pharmacy","other"]);
function clean(input){
 if(!input||typeof input!=="object"||Object.keys(input).some(k=>!fields.includes(k)&&k!=="observations"))throw Error("INVALID_FIELDS");
 const data={};
 for(const key of fields){
  if(typeof input[key]!=="string")throw Error("INVALID_FIELD");
  const v=input[key].trim();
  if(!v||v.length>200||/[\u0000-\u001f\u007f]/.test(v))throw Error("INVALID_FIELD");
  data[key]=v;
 }
 if(!allowedCategories.has(data.category)||!/^\+51[0-9]{9}$/.test(data.phone)||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))throw Error("INVALID_CONTACT_OR_CATEGORY");
 data.email=data.email.toLowerCase();
 if(input.observations!==undefined){if(typeof input.observations!=="string"||input.observations.length>1000||/[\u0000-\u001f\u007f]/.test(input.observations))throw Error("INVALID_FIELD");const note=input.observations.trim();if(note)data.observations=note;}
 return data;
}
const now=()=>new Date().toISOString();
const identity=d=>createHash("sha256").update(JSON.stringify(["business_name","department","province","district","address"].map(k=>d[k].normalize("NFKC").toLowerCase().trim().replace(/\s+/g," ")))).digest("hex");
function admin(actor){if(!actor||actor.role!=="merchant-reviewer"||typeof actor.id!=="string"||!actor.id.trim())throw Error("FORBIDDEN");}
export function openMerchantIntake(path,policy={enabled:false,privacyVersion:null}){
 const db=new DatabaseSync(path);
 db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;");
 db.exec(readFileSync(new URL("./schema.sql",import.meta.url),"utf8"));
 function tx(fn){db.exec("BEGIN IMMEDIATE");try{const r=fn();db.exec("COMMIT");return r;}catch(e){db.exec("ROLLBACK");throw e;}}
 try{tx(()=>{if(!db.prepare("PRAGMA table_info(merchant_requests)").all().some(c=>c.name==="observations"))db.exec("ALTER TABLE merchant_requests ADD COLUMN observations TEXT");for(const row of db.prepare("SELECT id,business_name,department,province,district,address FROM merchant_requests WHERE id NOT IN (SELECT request_id FROM merchant_identity_keys)").all())db.prepare("INSERT INTO merchant_identity_keys(identity_hash,request_id) VALUES (?,?)").run(identity(row),row.id);});}catch(e){db.close();throw e;}
 return {
  submit(input,{requestKey,privacyVersion,consent}={}){
   if(policy.enabled!==true||!policy.privacyVersion)throw Error("INTAKE_DISABLED");
   if(consent!==true||privacyVersion!==policy.privacyVersion)throw Error("PRIVACY_REQUIRED");
   if(typeof requestKey!=="string"||! /^[A-Za-z0-9_-]{16,100}$/.test(requestKey))throw Error("INVALID_REQUEST_KEY");
   const d=clean(input),hash=createHash("sha256").update(JSON.stringify([d,privacyVersion])).digest("hex");
   return tx(()=>{
    const old=db.prepare("SELECT id,payload_hash FROM merchant_requests WHERE request_key=?").get(requestKey);
    if(old){if(old.payload_hash!==hash)throw Error("IDEMPOTENCY_CONFLICT");return {id:old.id,replayed:true};}
    const fingerprint=identity(d);
    if(db.prepare("SELECT request_id FROM merchant_identity_keys WHERE identity_hash=?").get(fingerprint))throw Error("DUPLICATE_BUSINESS");
    const id=randomUUID(),at=now();
    db.prepare("INSERT INTO merchant_requests (id,request_key,payload_hash,business_name,category,department,province,district,address,contact_name,phone,email,privacy_version,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(id,requestKey,hash,...fields.map(k=>d[k]),privacyVersion,at);
    db.prepare("UPDATE merchant_requests SET observations=? WHERE id=?").run(d.observations??null,id);
    db.prepare("INSERT INTO merchant_identity_keys(identity_hash,request_id) VALUES (?,?)").run(fingerprint,id);
    db.prepare("INSERT INTO merchant_notification_outbox (request_id,created_at) VALUES (?,?)").run(id,at);
    return {id,replayed:false};
   });
  },
  list(actor,offset=0){admin(actor);if(!Number.isSafeInteger(offset)||offset<0)throw Error("INVALID_OFFSET");return db.prepare("SELECT id,business_name,category,department,province,district,address,contact_name,phone,email,observations,status,created_at FROM merchant_requests ORDER BY created_at,id LIMIT 100 OFFSET ?").all(offset);},
  history(actor,id){admin(actor);return db.prepare("SELECT actor_id,decision,created_at FROM merchant_review_events WHERE request_id=? ORDER BY id").all(id);},
  notificationState(actor,id){admin(actor);return db.prepare("SELECT status,attempts,sent_at FROM merchant_notification_outbox WHERE request_id=?").get(id)??null;},
  review(actor,id,decision){admin(actor);if(!["APPROVED","REJECTED"].includes(decision))throw Error("INVALID_DECISION");return tx(()=>{
   const r=db.prepare("UPDATE merchant_requests SET status=? WHERE id=? AND status='PENDING'").run(decision,id);
   if(r.changes!==1)throw Error("NOT_PENDING");
   db.prepare("INSERT INTO merchant_review_events (request_id,actor_id,decision,created_at) VALUES (?,?,?,?)").run(id,actor.id,decision,now());
   return {id,status:decision};
  });},
  pendingNotifications(actor){admin(actor);return db.prepare("SELECT request_id,attempts,created_at FROM merchant_notification_outbox WHERE status='PENDING' ORDER BY created_at LIMIT 100").all();},
  recordNotificationAttempt(actor,id,accepted){admin(actor);if(typeof accepted!=="boolean")throw Error("INVALID_DELIVERY_RESULT");const r=db.prepare("UPDATE merchant_notification_outbox SET attempts=attempts+1,status=?,sent_at=? WHERE request_id=? AND status='PENDING'").run(accepted?"SENT":"PENDING",accepted?now():null,id);if(r.changes!==1)throw Error("NOT_PENDING_NOTIFICATION");},
  claimNotification(actor,at=Date.now(),leaseMs=60000){admin(actor);if(!Number.isSafeInteger(at)||!Number.isSafeInteger(leaseMs)||leaseMs<1||leaseMs>300000)throw Error("INVALID_LEASE");return tx(()=>{
   const row=db.prepare("SELECT o.request_id FROM merchant_notification_outbox o LEFT JOIN merchant_notification_leases l ON l.request_id=o.request_id WHERE o.status='PENDING' AND (l.expires_at IS NULL OR l.expires_at<=?) ORDER BY o.created_at,o.request_id LIMIT 1").get(at);if(!row)return null;
   const token=randomUUID();db.prepare("INSERT INTO merchant_notification_leases(request_id,token,expires_at) VALUES (?,?,?) ON CONFLICT(request_id) DO UPDATE SET token=excluded.token,expires_at=excluded.expires_at").run(row.request_id,token,at+leaseMs);
   db.prepare("UPDATE merchant_notification_outbox SET attempts=attempts+1 WHERE request_id=?").run(row.request_id);return {request_id:row.request_id,token};});},
  finishNotification(actor,claim,accepted,at=Date.now()){admin(actor);if(typeof accepted!=="boolean")throw Error("INVALID_DELIVERY_RESULT");return tx(()=>{const l=db.prepare("SELECT token,expires_at FROM merchant_notification_leases WHERE request_id=?").get(claim.request_id);if(!l||l.token!==claim.token||l.expires_at<=at)throw Error("STALE_LEASE");const r=db.prepare("UPDATE merchant_notification_outbox SET status=?,sent_at=? WHERE request_id=? AND status='PENDING'").run(accepted?"SENT":"PENDING",accepted?new Date(at).toISOString():null,claim.request_id);if(r.changes!==1)throw Error("NOT_PENDING_NOTIFICATION");db.prepare("DELETE FROM merchant_notification_leases WHERE request_id=?").run(claim.request_id);});},
  close(){db.close();}
 };
}
