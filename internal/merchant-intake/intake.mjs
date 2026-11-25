// Internal reference implementation. No HTTP endpoint, credentials, mail delivery or production activation.
import {createHash,randomUUID} from "node:crypto";
import {readFileSync} from "node:fs";
import {DatabaseSync} from "node:sqlite";
const fields=["business_name","category","department","province","district","address","contact_name","phone","email"];
const allowedCategories=new Set(["restaurant","grocery","bakery","specialty","pharmacy","other"]);
function clean(input){
 if(!input||typeof input!=="object"||Object.keys(input).some(k=>!fields.includes(k)))throw Error("INVALID_FIELDS");
 const data={};
 for(const key of fields){
  if(typeof input[key]!=="string")throw Error("INVALID_FIELD");
  const v=input[key].trim();
  if(!v||v.length>200||/[\u0000-\u001f\u007f]/.test(v))throw Error("INVALID_FIELD");
  data[key]=v;
 }
 if(!allowedCategories.has(data.category)||!/^\+51[0-9]{9}$/.test(data.phone)||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))throw Error("INVALID_CONTACT_OR_CATEGORY");
 data.email=data.email.toLowerCase();
 return data;
}
const now=()=>new Date().toISOString();
function admin(actor){if(!actor||actor.role!=="merchant-reviewer"||typeof actor.id!=="string"||!actor.id.trim())throw Error("FORBIDDEN");}
export function openMerchantIntake(path,policy={enabled:false,privacyVersion:null}){
 const db=new DatabaseSync(path);
 db.exec("PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
 db.exec(readFileSync(new URL("./schema.sql",import.meta.url),"utf8"));
 function tx(fn){db.exec("BEGIN IMMEDIATE");try{const r=fn();db.exec("COMMIT");return r;}catch(e){db.exec("ROLLBACK");throw e;}}
 return {
  submit(input,{requestKey,privacyVersion,consent}={}){
   if(policy.enabled!==true||!policy.privacyVersion)throw Error("INTAKE_DISABLED");
   if(consent!==true||privacyVersion!==policy.privacyVersion)throw Error("PRIVACY_REQUIRED");
   if(typeof requestKey!=="string"||! /^[A-Za-z0-9_-]{16,100}$/.test(requestKey))throw Error("INVALID_REQUEST_KEY");
   const d=clean(input),hash=createHash("sha256").update(JSON.stringify([d,privacyVersion])).digest("hex");
   return tx(()=>{
    const old=db.prepare("SELECT id,payload_hash FROM merchant_requests WHERE request_key=?").get(requestKey);
    if(old){if(old.payload_hash!==hash)throw Error("IDEMPOTENCY_CONFLICT");return {id:old.id,replayed:true};}
    const id=randomUUID(),at=now();
    db.prepare("INSERT INTO merchant_requests (id,request_key,payload_hash,business_name,category,department,province,district,address,contact_name,phone,email,privacy_version,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(id,requestKey,hash,...fields.map(k=>d[k]),privacyVersion,at);
    db.prepare("INSERT INTO merchant_notification_outbox (request_id,created_at) VALUES (?,?)").run(id,at);
    return {id,replayed:false};
   });
  },
  list(actor){admin(actor);return db.prepare("SELECT id,business_name,category,department,province,district,address,contact_name,phone,email,status,created_at FROM merchant_requests ORDER BY created_at,id LIMIT 100").all();},
  review(actor,id,decision){admin(actor);if(!["APPROVED","REJECTED"].includes(decision))throw Error("INVALID_DECISION");return tx(()=>{
   const r=db.prepare("UPDATE merchant_requests SET status=? WHERE id=? AND status='PENDING'").run(decision,id);
   if(r.changes!==1)throw Error("NOT_PENDING");
   db.prepare("INSERT INTO merchant_review_events (request_id,actor_id,decision,created_at) VALUES (?,?,?,?)").run(id,actor.id,decision,now());
   return {id,status:decision};
  });},
  pendingNotifications(actor){admin(actor);return db.prepare("SELECT request_id,attempts,created_at FROM merchant_notification_outbox WHERE status='PENDING' ORDER BY created_at LIMIT 100").all();},
  recordNotificationAttempt(actor,id,accepted){admin(actor);if(typeof accepted!=="boolean")throw Error("INVALID_DELIVERY_RESULT");const r=db.prepare("UPDATE merchant_notification_outbox SET attempts=attempts+1,status=?,sent_at=? WHERE request_id=? AND status='PENDING'").run(accepted?"SENT":"PENDING",accepted?now():null,id);if(r.changes!==1)throw Error("NOT_PENDING_NOTIFICATION");},
  close(){db.close();}
 };
}
