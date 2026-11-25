import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {openMerchantIntake} from "../internal/merchant-intake/intake.mjs";
const actor={id:"synthetic-reviewer",role:"merchant-reviewer"};
const input={business_name:"Synthetic shop",category:"grocery",department:"Lima",province:"Huaura",district:"Huacho",address:"Test address",contact_name:"Synthetic person",phone:"+51900000000",email:"test@example.invalid"};
const opts={requestKey:"test-key-00000001",privacyVersion:"TEST-v1",consent:true};
test("intake disabled by default, even with consent",()=>{const s=openMerchantIntake(":memory:");try{assert.throws(()=>s.submit(input,opts),/INTAKE_DISABLED/);}finally{s.close();}});
test("valid synthetic intake survives restart, deduplicates and creates durable minimal notification",()=>{
 const dir=mkdtempSync(join(tmpdir(),"merchant-intake-"));const file=join(dir,"test.sqlite");const policy={enabled:true,privacyVersion:"TEST-v1"};let s;
 try{
 s=openMerchantIntake(file,policy);
 assert.throws(()=>s.submit(input,{...opts,consent:false}),/PRIVACY_REQUIRED/);
 assert.throws(()=>s.submit(input,{...opts,privacyVersion:"WRONG"}),/PRIVACY_REQUIRED/);
 assert.throws(()=>s.submit({...input,phone:"wrong"},opts),/INVALID_CONTACT/);
 assert.throws(()=>s.submit({...input,dni:"test"},opts),/INVALID_FIELDS/);
 const a=s.submit(input,opts);assert.equal(a.replayed,false);assert.equal(s.submit(input,opts).id,a.id);
 assert.throws(()=>s.submit({...input,business_name:"changed"},opts),/IDEMPOTENCY_CONFLICT/);
 assert.throws(()=>s.list({role:"public",id:"x"}),/FORBIDDEN/);
 assert.throws(()=>s.review(null,a.id,"APPROVED"),/FORBIDDEN/);
 s.close();s=openMerchantIntake(file,policy);
 assert.equal(s.list(actor).length,1);
 assert.equal(s.list(actor)[0].id,a.id);
 assert.equal(s.pendingNotifications(actor).length,1);
 assert.deepEqual(Object.keys(s.pendingNotifications(actor)[0]).sort(),["attempts","created_at","request_id"]);
 s.recordNotificationAttempt(actor,a.id,false);
 assert.equal(s.pendingNotifications(actor)[0].attempts,1);
 assert.equal(s.review(actor,a.id,"APPROVED").status,"APPROVED");
 assert.throws(()=>s.review(actor,a.id,"REJECTED"),/NOT_PENDING/);
 s.recordNotificationAttempt(actor,a.id,true);assert.equal(s.pendingNotifications(actor).length,0);
 assert.equal(s.list(actor)[0].status,"APPROVED");
 }finally{s?.close();rmSync(dir,{recursive:true,force:true});}
});
