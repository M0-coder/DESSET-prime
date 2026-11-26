import test from "node:test";import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";import {readFileSync} from "node:fs";
import {reconcileNotification,changeAccountStatus,accountHistory,notificationHistory} from "../internal/merchant-production/operations.mjs";
const id="00000000-0000-4000-8000-000000000104",actor="synthetic-reviewer";
function fixture(t,environment="staging"){
 const db=new DatabaseSync(":memory:");t.after(()=>db.close());db.exec("PRAGMA foreign_keys=ON");
 for(const name of ["schema.sql","migrations/0002-merchant-integration.sql","migrations/0003-merchant-drafts.sql","migrations/0004-merchant-operations.sql"])db.exec(readFileSync(new URL("../internal/merchant-production/"+name,import.meta.url),"utf8"));
 db.prepare("UPDATE merchant_runtime SET environment=?").run(environment);
 db.prepare("INSERT INTO merchant_requests(id,request_key,payload_hash,identity_hash,business_name,category,department,province,district,address,contact_name,phone,email,privacy_version,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(id,"synthetic-op-key","hash","identity","Synthetic operation","restaurant","Lima","Huaura","Huacho","Synthetic address","Synthetic person","+51900000000","operations@example.invalid","TEST",1);
 db.prepare("UPDATE merchant_requests SET status='APPROVED',reviewed_by=?,reviewed_at=2 WHERE id=?").run(actor,id);
 for(const stage of ["DOCUMENTATION_VERIFIED","CONTRACT_VERIFIED","CONFIGURATION_VERIFIED","READY_FOR_ACTIVATION"])db.prepare("UPDATE merchant_onboarding SET stage=?,actor_id=?,evidence_ref='SYNTHETIC-TEST',updated_at=3 WHERE request_id=?").run(stage,actor,id);
 const DB={prepare(sql){const s=db.prepare(sql),wrap=args=>({first:async()=>s.get(...args)??null,all:async()=>({results:s.all(...args)}),run:async()=>({meta:{changes:s.run(...args).changes}})});return {...wrap([]),bind:(...args)=>wrap(args)};}};
 return {db,env:{DB,ENVIRONMENT:environment}};
}
test("Ambiguous notification recovery is atomic, audited, and never resends automatically",async t=>{
 const {db,env}=fixture(t);db.prepare("UPDATE merchant_notification_outbox SET status='NEEDS_REVIEW',attempts=3 WHERE request_id=?").run(id);
 const n={id,decision:"CONFIRMED_NOT_SENT",evidence:"SYNTHETIC-RECONCILE"};
 const r=await reconcileNotification(env,actor,n,1000);assert.equal(r.status,"PENDING");assert.equal(r.retryAt,241000);
 assert.equal(db.prepare("SELECT next_attempt_at FROM merchant_notification_outbox WHERE request_id=?").get(id).next_attempt_at,241000);
 await assert.rejects(reconcileNotification(env,actor,n,1001),/RECONCILIATION_CONFLICT/);
 db.prepare("UPDATE merchant_notification_outbox SET status='NEEDS_REVIEW' WHERE request_id=?").run(id);
 await assert.rejects(reconcileNotification(env,actor,{...n,decision:"CONFIRMED_SENT"},1002),/INVALID_PROVIDER_REFERENCE/);
 const s=await reconcileNotification(env,actor,{...n,decision:"CONFIRMED_SENT",providerMessageId:"SYNTHETIC-RECEIPT"},1002);assert.equal(s.status,"SENT");
 assert.equal((await notificationHistory(env,id)).length,2);
});
test("Production lifecycle code requires independent authorization and persistent gate; suspension and terminal deactivation",async t=>{
 const {db,env}=fixture(t,"production");const a={id,from:"READY",to:"ACTIVE",version:0,reason:"Approved authorization",authorization:"approval-001"};
 await assert.rejects(changeAccountStatus(env,actor,a),/ACTIVATION_DISABLED/);
 db.exec("UPDATE merchant_runtime SET activation_enabled=1");
 const e={...env,ACTIVATION_ENABLED:"true",COMMERCIAL_POLICY_VERIFIED:"true",ACTIVATION_AUTHORIZATION_REF:"approval-001"};
 await assert.rejects(changeAccountStatus(e,actor,{...a,authorization:"wrong"}),/ACTIVATION_DISABLED/);
 assert.equal((await changeAccountStatus(e,actor,a,10)).status,"ACTIVE");
 await assert.rejects(changeAccountStatus(e,actor,a,11),/ACCOUNT_CONFLICT/);
 db.exec("UPDATE merchant_runtime SET activation_enabled=0");
 assert.equal((await changeAccountStatus(env,actor,{id,from:"ACTIVE",to:"SUSPENDED",version:1,reason:"Suspend account"},12)).status,"SUSPENDED");
 await assert.rejects(changeAccountStatus(e,actor,{...a,from:"SUSPENDED",version:2}),/ACTIVATION_DISABLED/);
 assert.equal((await changeAccountStatus(env,actor,{id,from:"SUSPENDED",to:"DEACTIVATED",version:2,reason:"Close account"},13)).status,"DEACTIVATED");
 assert.throws(()=>db.exec("UPDATE merchant_accounts SET status='ACTIVE',version=version+1,authorization_ref='approval-001'"));
 assert.equal((await accountHistory(env,id)).length,4);
});
test("Staging database cannot activate even with forged flags",async t=>{
 const {db,env}=fixture(t);const a={id,from:"READY",to:"ACTIVE",version:0,reason:"SYNTHETIC-TEST",authorization:"SYNTHETIC-AUTH"};
 await assert.rejects(changeAccountStatus({...env,ACTIVATION_ENABLED:"true",COMMERCIAL_POLICY_VERIFIED:"true",ACTIVATION_AUTHORIZATION_REF:"SYNTHETIC-AUTH"},actor,a),/ACTIVATION_DISABLED/);
 assert.throws(()=>db.exec("UPDATE merchant_accounts SET status='ACTIVE',version=version+1,authorization_ref='SYNTHETIC-AUTH'"));
});
