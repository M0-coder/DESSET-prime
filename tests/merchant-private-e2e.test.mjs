import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync,copyFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {randomBytes} from "node:crypto";
import {DatabaseSync} from "node:sqlite";
import {openMerchantIntake} from "../internal/merchant-intake/intake.mjs";
import {makeReviewerCredential,startSyntheticIntake} from "../internal/merchant-intake/server.mjs";
import {deliverOne,openSyntheticSink} from "../internal/merchant-intake/notifications.mjs";
const actor={id:"synthetic-reviewer",role:"merchant-reviewer"};
const input={business_name:"Synthetic <shop>",category:"grocery",department:"Lima",province:"Huaura",district:"Huacho",address:"Test address",contact_name:"Synthetic person",phone:"+51900000000",email:"test@example.invalid",observations:"<script>not code</script>"};
const opts={requestKey:"test-key-00000001",privacyVersion:"TEST-v1",consent:true};
function tmp(t){const dir=mkdtempSync(join(tmpdir(),"desset-intake-e2e-"));t.after(()=>rmSync(dir,{recursive:true,force:true}));return dir;}
async function fixture(t,enabled=true,sessionMs=900000){
 const dir=mkdtempSync(join(tmpdir(),"desset-intake-http-")),databasePath=join(dir,"intake.sqlite"),password=randomBytes(24).toString("hex"),credential=await makeReviewerCredential(password);
 let server=await startSyntheticIntake({databasePath,credential,syntheticEnabled:enabled,sessionMs});t.after(async()=>{try{if(server)await server.close();}finally{rmSync(dir,{recursive:true,force:true});}});
 const request=(path,{method="GET",body,cookie,csrf,origin,form=false,headers={}}={})=>fetch(server.origin+path,{method,redirect:"manual",headers:{...(method==="POST"?{Origin:origin??server.origin,"Content-Type":form?"application/x-www-form-urlencoded":"application/json"}:{}),...(cookie?{Cookie:cookie}:{}),...(csrf?{"X-CSRF-Token":csrf}:{}),...headers},body:body===undefined?undefined:form?new URLSearchParams(body):JSON.stringify(body)});
 const login=async()=>{const r=await request("/login",{method:"POST",body:{password},form:true});assert.equal(r.status,303);const cookie=r.headers.get("set-cookie");assert.match(cookie,/HttpOnly; SameSite=Strict/);return cookie.split(";")[0];};
 return {dir,databasePath,request,login,async restart(){await server.close();server=null;server=await startSyntheticIntake({databasePath,credential,syntheticEnabled:enabled,sessionMs});}};
}
const submit=(f,data=input,extra={})=>f.request("/api/intake",{method:"POST",body:{input:data,...opts,...extra}});
test("E2E default closed, private routes inaccessible, no source or sqlite served",async t=>{
 const f=await fixture(t,false);
 assert.equal((await submit(f)).status,503);
 assert.equal((await f.request("/admin")).status,401);
 assert.equal((await f.request("/api/admin/requests")).status,401);
 assert.equal((await f.request("/internal/merchant-intake/schema.sql")).status,404);
 assert.equal((await f.request("/intake.sqlite")).status,404);
 const store=openMerchantIntake(f.databasePath);try{assert.equal(store.list(actor).length,0);}finally{store.close();}
});
test("E2E concurrent intake, duplicate identities, restart, auth, escaped panel, CSRF and audited review",async t=>{
 const f=await fixture(t);
 const responses=await Promise.all(Array.from({length:8},()=>submit(f)));
 assert.equal(responses.filter(r=>r.status===201).length,1);
 assert.equal(responses.filter(r=>r.status===200).length,7);
 const ids=await Promise.all(responses.map(r=>r.json()));assert.equal(new Set(ids.map(x=>x.id)).size,1);const id=ids[0].id;
 assert.equal((await submit(f,{...input,business_name:"Synthetic  <SHOP>"},{requestKey:"different-key-0001"})).status,409);
 assert.equal((await submit(f,{...input,address:"Changed"})).status,409);
 assert.equal((await submit(f,{...input,email:"test@example.com"})).status,400);
 assert.equal((await submit(f,input,{consent:false})).status,400);
 assert.equal((await f.request("/api/intake",{method:"POST",origin:"https://example.invalid",body:{input,...opts}})).status,403);
 assert.equal((await f.request("/api/admin/requests",{headers:{"X-Role":"merchant-reviewer"}})).status,401);
 assert.equal((await f.request("/login",{method:"POST",form:true,body:{password:"wrong"}})).status,401);
 const oldCookie=await f.login();await f.restart();
 assert.equal((await f.request("/api/admin/requests",{cookie:oldCookie})).status,401);
 const cookie=await f.login(),r=await f.request("/api/admin/requests",{cookie});
 assert.equal(r.status,200);assert.equal(r.headers.get("cache-control"),"no-store");
 const state=await r.json();assert.equal(state.requests.length,1);assert.equal(state.requests[0].id,id);assert.equal(state.requests[0].notification.status,"PENDING");assert.equal(state.requests[0].observations,input.observations);
 const html=await (await f.request("/admin",{cookie})).text();assert.match(html,/&lt;script&gt;not code&lt;\/script&gt;/);assert.doesNotMatch(html,/<script>/);
 assert.equal((await f.request("/api/admin/review",{method:"POST",cookie,body:{id,decision:"APPROVED"}})).status,403);
 assert.equal((await f.request("/api/admin/review",{method:"POST",cookie,csrf:state.csrf,body:{id,decision:"APPROVED",actor:"forged"}})).status,400);
 assert.equal((await f.request("/api/admin/review",{method:"POST",cookie,csrf:state.csrf,body:{id,decision:"APPROVED"}})).status,200);
 assert.equal((await f.request("/api/admin/review",{method:"POST",cookie,csrf:state.csrf,body:{id,decision:"REJECTED"}})).status,409);
 const updated=await (await f.request("/api/admin/requests",{cookie})).json();
 assert.equal(updated.requests[0].history.length,1);assert.equal(updated.requests[0].history[0].actor_id,"synthetic-owner");
 assert.equal((await f.request("/logout",{method:"POST",cookie,form:true,body:{csrf:state.csrf}})).status,303);
 assert.equal((await f.request("/admin",{cookie})).status,401);
});
test("storage failure rolls back request, identity and outbox; retry succeeds",async t=>{
 const f=await fixture(t),db=new DatabaseSync(f.databasePath);
 try{db.exec("CREATE TRIGGER synthetic_failure BEFORE INSERT ON merchant_notification_outbox BEGIN SELECT RAISE(ABORT,'forced failure'); END;");
 const response=await submit(f);assert.equal(response.status,500);assert.deepEqual(await response.json(),{error:"INTERNAL_ERROR"});
 assert.equal(db.prepare("SELECT count(*) AS n FROM merchant_requests").get().n,0);
 assert.equal(db.prepare("SELECT count(*) AS n FROM merchant_identity_keys").get().n,0);
 db.exec("DROP TRIGGER synthetic_failure");assert.equal((await submit(f)).status,201);
 }finally{db.close();}
});
test("durable outbox: concurrent claim, expired lease, provider failure and accepted-then-lost receipt deduplicate after restart",async t=>{
 const dir=tmp(t),path=join(dir,"intake.sqlite"),sinkPath=join(dir,"sink.sqlite"),policy={enabled:true,privacyVersion:"TEST-v1"};
 let a=openMerchantIntake(path,policy),b=openMerchantIntake(path,policy),sink=openSyntheticSink(sinkPath);
 try{const id=a.submit(input,opts).id;const c=a.claimNotification(actor,100,10);assert.equal(c.request_id,id);assert.equal(b.claimNotification(actor,105,10),null);
 const next=b.claimNotification(actor,111,10);assert.notEqual(next.token,c.token);assert.throws(()=>a.finishNotification(actor,c,true,112),/STALE_LEASE/);b.finishNotification(actor,next,false,112);
 assert.equal((await deliverOne(a,{send:async()=>{throw Error("offline");}},{clock:()=>200})).state,"RETRY");
 assert.equal((await deliverOne(a,{send:async m=>{await sink.send(m);throw Error("lost acknowledgement");}},{clock:()=>300})).state,"RETRY");
 assert.equal(sink.count(),1);a.close();a=null;b.close();b=null;sink.close();sink=null;
 a=openMerchantIntake(path,policy);sink=openSyntheticSink(sinkPath);
 assert.equal((await deliverOne(a,sink,{clock:()=>400})).state,"SENT");assert.equal(sink.count(),1);
 assert.equal((await deliverOne(a,sink,{clock:()=>500})).state,"EMPTY");
 assert.equal(a.notificationState(actor,id).status,"SENT");assert.equal(a.notificationState(actor,id).attempts,5);
 assert.equal(a.list(actor).length,1);
 }finally{a?.close();b?.close();sink?.close();}
});
test("SQLite closed backup restores request and pending notification",t=>{
 const dir=tmp(t),file=join(dir,"intake.sqlite"),backup=join(dir,"restored.sqlite"),policy={enabled:true,privacyVersion:"TEST-v1"};
 const a=openMerchantIntake(file,policy);let id;try{id=a.submit(input,opts).id;}finally{a.close();}
 copyFileSync(file,backup);const b=openMerchantIntake(backup,policy);try{assert.equal(b.list(actor)[0].id,id);assert.equal(b.notificationState(actor,id).status,"PENDING");}finally{b.close();}
});
