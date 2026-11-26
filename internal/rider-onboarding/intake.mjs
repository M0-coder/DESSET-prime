// Rider intake uses the same territorial source as merchant onboarding, not a second catalog.
import {resolveTerritory} from "../merchant-common/territory.mjs";
export const RIDER_ORIGIN="https://repartidores.desset.lat";
export const fields=["full_name","phone","email","department","province","district","vehicle"];
const fail=(status,publicCode)=>Object.assign(Error(publicCode),{status,publicCode});
const encoder=new TextEncoder();
const hex=b=>Array.from(b,x=>x.toString(16).padStart(2,"0")).join("");
const digest=async s=>hex(new Uint8Array(await crypto.subtle.digest("SHA-256",encoder.encode(s))));
const random=()=>hex(crypto.getRandomValues(new Uint8Array(32)));
const key=v=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v);
const ref=v=>typeof v==="string"&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{1,119}$/.test(v);
const clean=(v,max)=>{if(typeof v!=="string"||!v.trim()||v.trim().length>max||/[\u0000-\u001f\u007f]/.test(v))throw fail(400,"INVALID_FIELD");return v.trim().normalize("NFC");};
export function normalizeRider(input,{synthetic=false}={}){
 if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).length!==fields.length||Object.keys(input).some(k=>!fields.includes(k)))throw fail(400,"INVALID_FIELDS");
 const full_name=clean(input.full_name,120),phone=clean(input.phone,20).replace(/ /g,""),email=clean(input.email,200).toLowerCase();
 if(!/^\+51[0-9]{9}$/.test(phone)||! /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)||!["bicycle","motorcycle","car"].includes(input.vehicle))throw fail(400,"INVALID_CONTACT_OR_VEHICLE");
 if(synthetic&&(!full_name.startsWith("Synthetic ")||phone!=="+51900000000"||!email.endsWith(".invalid")))throw fail(400,"SYNTHETIC_ONLY");
 if(!synthetic&&(email.endsWith(".invalid")||full_name.startsWith("Synthetic ")))throw fail(400,"INVALID_CONTACT_OR_VEHICLE");
 let t;try{t=resolveTerritory(input.department,input.province,input.district);}catch{throw fail(400,"INVALID_LOCATION");}
 return {full_name,phone,email,ubigeo:t.ubigeo,department:t.department,province:t.province,district:t.district,vehicle:input.vehicle};
}
export async function riderGate(env){
 if(!env.RIDER_DB||env.ENVIRONMENT!=="production"||env.SERVICE_ORIGIN!==RIDER_ORIGIN||env.RIDER_INTAKE_ENABLED!=="true"||env.RIDER_POLICY_VERIFIED!=="true"||env.TERRITORY_VERIFIED!=="true"||!ref(env.LAUNCH_AUTHORIZATION_REF)||!ref(env.PRIVACY_VERSION))throw fail(503,"INTAKE_DISABLED");
 const s=await env.RIDER_DB.prepare("SELECT environment,intake_enabled,privacy_version,authorization_ref FROM rider_runtime WHERE id=1").first();
 if(!s||s.environment!=="production"||s.intake_enabled!==1||s.privacy_version!==env.PRIVACY_VERSION||s.authorization_ref!==env.LAUNCH_AUTHORIZATION_REF)throw fail(503,"INTAKE_DISABLED");
 if(typeof env.PRIVACY_NOTICE!=="string"||env.PRIVACY_NOTICE.trim().length<200||encoder.encode(env.PRIVACY_NOTICE).length>8000||!key(env.PRIVACY_NOTICE_SHA256)||await digest(env.PRIVACY_NOTICE)!==env.PRIVACY_NOTICE_SHA256)throw fail(503,"PRIVACY_NOT_READY");
 return s;
}
export async function createDraft(env,session,input,consent,at=Date.now()){
 const s=await riderGate(env);if(!key(session)||consent!==true)throw fail(400,"INVALID_REQUEST");const data=normalizeRider(input),actor=await digest(session),token=random(),hash=await digest(token),requestKey=random(),payload=JSON.stringify({data,privacyVersion:s.privacy_version});
 const db=env.RIDER_DB;await db.prepare("DELETE FROM rider_drafts WHERE expires_at<=?").bind(at).run();
 const result=await db.prepare("INSERT INTO rider_drafts(key_hash,actor_hash,request_key,payload_json,expires_at) SELECT ?,?,?,?,? WHERE (SELECT count(*) FROM rider_drafts WHERE actor_hash=?)<4 AND (SELECT count(*) FROM rider_drafts)<512 AND EXISTS(SELECT 1 FROM rider_runtime WHERE id=1 AND environment='production' AND intake_enabled=1 AND privacy_version=? AND authorization_ref=?) RETURNING key_hash").bind(hash,actor,requestKey,payload,at+900000,actor,s.privacy_version,env.LAUNCH_AUTHORIZATION_REF).first();
 if(!result)throw fail(429,"DRAFT_CAPACITY");return {token,data};
}
async function draft(env,session,token,at){
 if(!key(session)||!key(token))throw fail(400,"DRAFT_EXPIRED");
 const hash=await digest(token),actor=await digest(session),r=await env.RIDER_DB.prepare("SELECT request_key,payload_json,receipt_id FROM rider_drafts WHERE key_hash=? AND actor_hash=? AND expires_at>?").bind(hash,actor,at).first();
 if(!r)throw fail(400,"DRAFT_EXPIRED");return {...r,hash,actor};
}
export async function editDraft(env,session,token,at=Date.now()){
 await riderGate(env);const d=await draft(env,session,token,at);if(d.receipt_id)throw fail(409,"ALREADY_SUBMITTED");
 const r=await env.RIDER_DB.prepare("DELETE FROM rider_drafts WHERE key_hash=? AND actor_hash=? AND receipt_id IS NULL AND expires_at>? RETURNING key_hash").bind(d.hash,d.actor,at).first();
 if(!r)throw fail(409,"DRAFT_EXPIRED");return JSON.parse(d.payload_json).data;
}
export async function submitDraft(env,session,token,at=Date.now()){
 const s=await riderGate(env),d=await draft(env,session,token,at);if(d.receipt_id)return {id:d.receipt_id,replayed:true};
 const payload=JSON.parse(d.payload_json);if(payload.privacyVersion!==s.privacy_version)throw fail(409,"PRIVACY_CHANGED");
 const data=normalizeRider(Object.fromEntries(fields.map(k=>[k,payload.data[k]]))),hash=await digest(JSON.stringify(payload)),identity=await digest(JSON.stringify([data.email,data.phone])),id=crypto.randomUUID();
 let r;try{r=await env.RIDER_DB.prepare("INSERT INTO rider_requests(id,request_key,payload_hash,identity_hash,full_name,phone,email,ubigeo,department,province,district,vehicle,privacy_version,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM rider_runtime WHERE id=1 AND environment='production' AND intake_enabled=1 AND privacy_version=? AND authorization_ref=?) AND EXISTS(SELECT 1 FROM rider_drafts WHERE key_hash=? AND actor_hash=? AND request_key=? AND expires_at>? AND receipt_id IS NULL) ON CONFLICT(request_key) DO NOTHING RETURNING id").bind(id,d.request_key,hash,identity,data.full_name,data.phone,data.email,data.ubigeo,data.department,data.province,data.district,data.vehicle,s.privacy_version,at,s.privacy_version,env.LAUNCH_AUTHORIZATION_REF,d.hash,d.actor,d.request_key,at).first();}catch(e){if(String(e.message).includes("UNIQUE constraint failed: rider_requests.identity_hash"))throw fail(409,"DUPLICATE_REQUEST");throw e;}
 if(r?.id===id)return {id,replayed:false};
 const old=await env.RIDER_DB.prepare("SELECT id,payload_hash FROM rider_requests WHERE request_key=?").bind(d.request_key).first();if(old?.payload_hash===hash)return {id:old.id,replayed:true};throw fail(409,"DRAFT_EXPIRED");
}
export const newSession=random;
export const csrfToken=session=>digest("desset-rider-v1:"+session);
