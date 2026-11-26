// Initial establishment preparation, not the day-to-day menu or order app.
const fail=(status,publicCode)=>Object.assign(Error(publicCode),{status,publicCode});
const uuid=v=>typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v);
const text=(v,max,required=true)=>{if(typeof v!=="string"||v.trim().length>max||(required&&!v.trim())||/[\u0000-\u0008\u000b-\u001f\u007f]/.test(v))throw fail(400,"INVALID_PROFILE");return v.trim();};
const ref=v=>typeof v==="string"&&/^[A-Za-z0-9][A-Za-z0-9_.:-]{2,119}$/.test(v);
const integer=(v,min,max)=>{if(typeof v!=="string"||!/^\d+$/.test(v)||!Number.isSafeInteger(Number(v))||Number(v)<min||Number(v)>max)throw fail(400,"INVALID_PROFILE");return Number(v);};
const digest=async b=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",b)),x=>x.toString(16).padStart(2,"0")).join("");
export const days=["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
async function context(env,id,approved=false){
 if(!uuid(id))throw fail(400,"INVALID_REFERENCE");
 const s=await env.DB?.prepare("SELECT environment,intake_enabled,notification_enabled,activation_enabled FROM merchant_runtime WHERE id=1").first();
 if(!s||s.environment!==env.ENVIRONMENT||!["production","staging"].includes(s.environment))throw fail(503,"UNAVAILABLE");
 if(s.environment==="staging"&&(s.intake_enabled!==0||s.notification_enabled!==0||s.activation_enabled!==0))throw fail(503,"STAGING_NOT_ISOLATED");
 const row=await env.DB.prepare("SELECT r.id,r.business_name,r.status,n.stage FROM merchant_requests r LEFT JOIN merchant_onboarding n ON n.request_id=r.id WHERE r.id=?").bind(id).first();
 if(!row)throw fail(404,"NOT_FOUND");if(approved&&row.status!=="APPROVED")throw fail(409,"NOT_APPROVED");return row;
}
const blank=()=>({name:"",description:"",logo:null,hours:days.map(()=>null),products:[]});
async function current(env,id){
 const r=await env.DB.prepare("SELECT version,payload_json FROM merchant_profiles WHERE request_id=?").bind(id).first();
 return r?{version:r.version,profile:JSON.parse(r.payload_json)}:{version:0,profile:blank()};
}
async function mediaRows(env,id){return (await env.DB.prepare("SELECT id,mime,sha256,size_bytes FROM merchant_profile_media WHERE request_id=? ORDER BY created_at,id").bind(id).all()).results;}
export async function getPreparation(env,id){
 const request=await context(env,id),contacts=(await env.DB.prepare("SELECT channel,outcome,notes,actor_id,created_at FROM merchant_contact_events WHERE request_id=? ORDER BY created_at DESC,id DESC LIMIT 100").bind(id).all()).results;
 const p=await current(env,id),media=await mediaRows(env,id),review=await env.DB.prepare("SELECT decision,evidence_ref,actor_id,created_at FROM merchant_profile_reviews WHERE request_id=? AND version=?").bind(id,p.version).first();
 return {request,contacts,...p,media,review:review??null};
}
export async function recordContact(env,actor,b){
 await context(env,b.id);
 if(!actor||!["PHONE","EMAIL","MEETING","OTHER"].includes(b.channel)||!["CONTACTED","NO_ANSWER","FOLLOW_UP","DECLINED"].includes(b.outcome))throw fail(400,"INVALID_CONTACT");
 const notes=text(b.notes??"",1000,false);
 await env.DB.prepare("INSERT INTO merchant_contact_events(id,request_id,channel,outcome,notes,actor_id,created_at) VALUES(?,?,?,?,?,?,?)").bind(crypto.randomUUID(),b.id,b.channel,b.outcome,notes,actor,Date.now()).run();
}
function storage(env){if(!env.DOCUMENTS||env.DOCUMENTS_ENVIRONMENT!==env.ENVIRONMENT)throw fail(503,"DOCUMENT_STORAGE_DISABLED");return env.DOCUMENTS;}
function imageMime(bytes){
 if(!(bytes instanceof Uint8Array)||bytes.length<12||bytes.length>2097152)throw fail(400,"INVALID_IMAGE");
 if([137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b)&&bytes[12]===73&&bytes[13]===72&&bytes[14]===68&&bytes[15]===82)return "image/png";
 if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255&&bytes.at(-2)===255&&bytes.at(-1)===217)return "image/jpeg";
 throw fail(400,"INVALID_IMAGE");
}
export async function uploadProfileMedia(env,actor,id,bytes){
 const r=await context(env,id,true);if(!actor||r.stage==="READY_FOR_ACTIVATION")throw fail(409,"PROFILE_LOCKED");
 const mime=imageMime(bytes),bucket=storage(env),mid=crypto.randomUUID(),key=env.ENVIRONMENT+"/"+id+"/media/"+mid,hash=await digest(bytes);
 if((await mediaRows(env,id)).length>=200)throw fail(409,"MEDIA_LIMIT");
 await bucket.put(key,bytes,{httpMetadata:{contentType:mime},customMetadata:{sha256:hash}});
 try{const q=await env.DB.prepare("INSERT INTO merchant_profile_media(id,request_id,object_key,mime,sha256,size_bytes,actor_id,created_at) SELECT ?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM merchant_onboarding WHERE request_id=? AND stage<>'READY_FOR_ACTIVATION') AND (SELECT count(*) FROM merchant_profile_media WHERE request_id=?)<200 RETURNING id").bind(mid,id,key,mime,hash,bytes.length,actor,Date.now(),id,id).first();if(!q)throw fail(409,"PROFILE_LOCKED");}
 catch(e){let exists;try{exists=await env.DB.prepare("SELECT id FROM merchant_profile_media WHERE id=?").bind(mid).first();}catch{throw e;}if(!exists)await bucket.delete(key);throw e;}
 return mid;
}
export async function readProfileMedia(env,id,mid){
 await context(env,id,true);if(!uuid(mid))throw fail(400,"INVALID_REFERENCE");
 const row=await env.DB.prepare("SELECT object_key,mime,sha256,size_bytes FROM merchant_profile_media WHERE id=? AND request_id=?").bind(mid,id).first();if(!row)throw fail(404,"NOT_FOUND");
 const obj=await storage(env).get(row.object_key);if(!obj||obj.size!==row.size_bytes)throw fail(503,"MEDIA_INTEGRITY");
 const bytes=new Uint8Array(await obj.arrayBuffer());if(await digest(bytes)!==row.sha256||imageMime(bytes)!==row.mime)throw fail(503,"MEDIA_INTEGRITY");
 return {bytes,mime:row.mime};
}
function mediaRef(v,allowed,optional=false){if(optional&&!v)return null;if(!uuid(v)||!allowed.has(v))throw fail(400,"INVALID_IMAGE_REFERENCE");return v;}
function time(v){return typeof v==="string"&&/^([01]\d|2[0-3]):[0-5]\d$/.test(v);}
export async function editProfile(env,actor,b){
 const r=await context(env,b.id,true);if(!actor||r.stage==="READY_FOR_ACTIVATION")throw fail(409,"PROFILE_LOCKED");
 const old=await current(env,b.id),version=integer(b.version,0,1000000);if(version!==old.version)throw fail(409,"PROFILE_CONFLICT");
 const p=old.profile,allowed=new Set((await mediaRows(env,b.id)).map(x=>x.id));
 if(b.operation==="DETAILS"){
  p.name=text(b.name,120);p.description=text(b.description??"",500,false);p.logo=mediaRef(b.logo,allowed,true);
  p.hours=days.map((_,i)=>{const start=b["open"+i]??"",end=b["close"+i]??"";if(!start&&!end)return null;if(!time(start)||!time(end)||start===end)throw fail(400,"INVALID_HOURS");return {open:start,close:end};});
 }else if(b.operation==="PRODUCT"){
  const pid=b.productId||crypto.randomUUID();if(!uuid(pid))throw fail(400,"INVALID_PROFILE");
  if(b.productId&&!p.products.some(x=>x.id===pid))throw fail(404,"NOT_FOUND");
  const price=String(b.price??"");if(!/^\d{1,5}(?:\.\d{1,2})?$/.test(price))throw fail(400,"INVALID_PRICE");
  const [whole,fraction=""]=price.split("."),priceCents=Number(whole)*100+Number(fraction.padEnd(2,"0"));if(priceCents<1)throw fail(400,"INVALID_PRICE");
  const product={id:pid,category:text(b.category,80),name:text(b.productName,120),description:text(b.productDescription??"",500,false),priceCents,photo:mediaRef(b.photo,allowed)};
  p.products=p.products.filter(x=>x.id!==pid);p.products.push(product);if(p.products.length>100)throw fail(409,"PRODUCT_LIMIT");
 }else if(b.operation==="REMOVE"){
  if(!uuid(b.productId)||!p.products.some(x=>x.id===b.productId))throw fail(404,"NOT_FOUND");p.products=p.products.filter(x=>x.id!==b.productId);
 }else throw fail(400,"INVALID_PROFILE");
 const payload=JSON.stringify(p);if(payload.length>100000)throw fail(413,"BODY_LIMIT");
 const q=version===0?await env.DB.prepare("INSERT INTO merchant_profiles(request_id,version,payload_json,actor_id,updated_at) SELECT ?,1,?,?,? WHERE EXISTS(SELECT 1 FROM merchant_onboarding WHERE request_id=? AND stage<>'READY_FOR_ACTIVATION') ON CONFLICT(request_id) DO NOTHING RETURNING version").bind(b.id,payload,actor,Date.now(),b.id).first():await env.DB.prepare("UPDATE merchant_profiles SET version=version+1,payload_json=?,actor_id=?,updated_at=? WHERE request_id=? AND version=? AND EXISTS(SELECT 1 FROM merchant_onboarding WHERE request_id=? AND stage<>'READY_FOR_ACTIVATION') RETURNING version").bind(payload,actor,Date.now(),b.id,version,b.id).first();
 if(!q)throw fail(409,"PROFILE_CONFLICT");return q.version;
}
export async function reviewProfile(env,actor,b){
 const r=await context(env,b.id,true),p=await current(env,b.id),version=integer(b.version,1,1000001);
 if(!actor||!ref(b.evidence)||!["APPROVED","CORRECTIONS_REQUIRED"].includes(b.decision)||p.version!==version||r.stage==="READY_FOR_ACTIVATION")throw fail(409,"PROFILE_REVIEW_CONFLICT");
 if(b.decision==="APPROVED"){
  if(!p.profile.name||!p.profile.products.length||!p.profile.hours.some(Boolean))throw fail(409,"PROFILE_INCOMPLETE");
  const ids=new Set([p.profile.logo,...p.profile.products.map(x=>x.photo)].filter(Boolean));for(const mid of ids)await readProfileMedia(env,b.id,mid);
 }
 const q=await env.DB.prepare("INSERT INTO merchant_profile_reviews(request_id,version,decision,evidence_ref,actor_id,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM merchant_profiles WHERE request_id=? AND version=?) AND EXISTS(SELECT 1 FROM merchant_onboarding WHERE request_id=? AND stage<>'READY_FOR_ACTIVATION') ON CONFLICT(request_id,version) DO NOTHING RETURNING version").bind(b.id,version,b.decision,b.evidence,actor,Date.now(),b.id,version,b.id).first();
 if(!q)throw fail(409,"PROFILE_REVIEW_CONFLICT");
}
export async function approvedProfile(env,id){
 await context(env,id,true);const row=await env.DB.prepare("SELECT p.version,p.payload_json FROM merchant_profiles p JOIN merchant_profile_reviews r ON r.request_id=p.request_id AND r.version=p.version WHERE p.request_id=? AND r.decision='APPROVED'").bind(id).first();
 return row?{schemaVersion:1,merchantId:id,profileVersion:row.version,currency:"PEN",...JSON.parse(row.payload_json)}:null;
}
