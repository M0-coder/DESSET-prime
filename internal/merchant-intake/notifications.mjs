// Private leased outbox consumer and durable, non-network synthetic notification sink.
import {DatabaseSync} from "node:sqlite";
const actor=Object.freeze({id:"synthetic-notifier",role:"merchant-reviewer"});
export async function deliverOne(store,provider,{clock=Date.now,leaseMs=60000,retryBaseMs=1000}={}){
 if(!Number.isSafeInteger(retryBaseMs)||retryBaseMs<1||retryBaseMs>3600000)throw Error("INVALID_RETRY_INTERVAL");
 const claim=store.claimNotification(actor,clock(),leaseMs);if(!claim)return {state:"EMPTY"};
 const key="merchant-request:"+claim.request_id;
 let accepted=false;
 try{const receipt=await provider.send({idempotencyKey:key,reference:claim.request_id});accepted=receipt?.accepted===true;}catch{/* No applicant fields or raw provider errors in logs. */}
 const at=clock(),delay=Math.min(3600000,retryBaseMs*2**Math.min(claim.attempts-1,20));
 try{store.finishNotification(actor,claim,accepted,at,accepted?at:at+delay);}catch(e){if(e.message==="STALE_LEASE")return {state:"LEASE_LOST"};throw e;}
 return {state:accepted?"SENT":"RETRY"};
}
export function openSyntheticSink(path){
 const db=new DatabaseSync(path);db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS synthetic_receipts (idempotency_key TEXT PRIMARY KEY, reference TEXT NOT NULL);");
 return {async send(message){if(Object.keys(message).sort().join(",")!=="idempotencyKey,reference"||message.idempotencyKey!=="merchant-request:"+message.reference||!/^[a-f0-9-]{36}$/.test(message.reference))throw Error("INVALID_NOTIFICATION");db.prepare("INSERT INTO synthetic_receipts VALUES (?,?) ON CONFLICT(idempotency_key) DO NOTHING").run(message.idempotencyKey,message.reference);return {accepted:true};},count(){return db.prepare("SELECT count(*) AS n FROM synthetic_receipts").get().n;},close(){db.close();}};
}
