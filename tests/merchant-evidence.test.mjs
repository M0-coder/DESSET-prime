import test from "node:test";import assert from "node:assert/strict";import {DatabaseSync} from "node:sqlite";import {readFileSync} from "node:fs";
import {uploadDocument,reviewDocument,downloadDocument,saveConfiguration,listEvidence,merchantAccountSnapshot} from "../internal/merchant-production/evidence.mjs";
import {changeAccountStatus} from "../internal/merchant-production/operations.mjs";
import {advanceOnboarding,handle,PRODUCTION_ORIGIN} from "../internal/merchant-production/worker.mjs";
import {issueAcceptance,acceptanceView,decideAcceptance,revokeAcceptance,listAcceptances} from "../internal/merchant-production/acceptance.mjs";
import {recordContact,editProfile,reviewProfile,uploadProfileMedia,approvedProfile,getPreparation,commercialMessage} from "../internal/merchant-production/profile.mjs";
import {preparationPage} from "../internal/merchant-production/profile-view.mjs";
const id="00000000-0000-4000-8000-000000000601",actor="reviewer";
function fixture(t){
 const db=new DatabaseSync(":memory:");t.after(()=>db.close());db.exec("PRAGMA foreign_keys=ON");
 for(const f of ["schema.sql","migrations/0002-merchant-integration.sql","migrations/0003-merchant-drafts.sql","migrations/0004-merchant-operations.sql","migrations/0005-merchant-launch.sql","migrations/0006-merchant-evidence.sql","migrations/0007-merchant-profile.sql","migrations/0008-merchant-acceptance.sql"])db.exec(readFileSync(new URL("../internal/merchant-production/"+f,import.meta.url),"utf8"));
 db.exec("UPDATE merchant_runtime SET environment='production'");
 db.prepare("INSERT INTO merchant_requests(id,request_key,payload_hash,identity_hash,business_name,category,department,province,district,address,contact_name,phone,email,privacy_version,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(id,"synthetic-601","hash","identity","Test shop","restaurant","Lima","Huaura","Huacho","Test address","Test contact","+51900000000","test@example.test","v1",1);
 db.prepare("UPDATE merchant_requests SET status='APPROVED',reviewed_by='reviewer',reviewed_at=2 WHERE id=?").run(id);
 const DB={prepare(sql){const s=db.prepare(sql),wrap=args=>({first:async()=>s.get(...args)??null,all:async()=>({results:s.all(...args)}),run:async()=>({meta:{changes:s.run(...args).changes}})});return {...wrap([]),bind:(...args)=>wrap(args)};}};
 const objects=new Map(),DOCUMENTS={put:async(k,v)=>objects.set(k,v.slice()),get:async k=>{const a=objects.get(k);return a?{size:a.length,arrayBuffer:async()=>a.buffer.slice(0)}:null;},delete:async k=>objects.delete(k)};
 return {db,objects,env:{DB,ENVIRONMENT:"production",DOCUMENTS,DOCUMENTS_ENVIRONMENT:"production"}};
}
test("Production evidence is durable, quarantined, verified and required before advancement",async t=>{
 const {db,objects,env}=fixture(t),bytes=new TextEncoder().encode("%PDF-1.7\nDESSET-SYNTHETIC\n%%EOF");
 const advance=(from,to)=>advanceOnboarding(env,actor,{id,from,to,evidence:"review-601"});
 await assert.rejects(advance("EVALUATION_APPROVED","DOCUMENTATION_VERIFIED"),/EVIDENCE_REQUIRED/);
 await assert.rejects(uploadDocument({...env,DOCUMENTS_ENVIRONMENT:"staging"},actor,{id,kind:"RUC",bytes}),/DOCUMENT_STORAGE_DISABLED/);
 await assert.rejects(uploadDocument(env,actor,{id,kind:"RUC",bytes:new Uint8Array(9)}),/INVALID_DOCUMENT/);
 const ruc=await uploadDocument(env,actor,{id,kind:"RUC",bytes});assert.equal(ruc.status,"QUARANTINED");
 assert.deepEqual(await downloadDocument(env,ruc.id),bytes);
 await reviewDocument(env,actor,{doc:ruc.id,decision:"VERIFIED",evidence:"review-scan-001"});
 await assert.rejects(reviewDocument(env,actor,{doc:ruc.id,decision:"REJECTED",evidence:"review-scan-002"}),/DOCUMENT_REVIEW_CONFLICT/);
 for(const kind of ["REPRESENTATION","PERMIT","SIGNED_CONTRACT"]){const d=await uploadDocument(env,actor,{id,kind,bytes});await reviewDocument(env,actor,{doc:d.id,decision:"VERIFIED",evidence:"review-scan-003"});}
 await saveConfiguration(env,actor,{id,ruc:"20100070970",commissionBps:1350,serviceMinutes:30,payoutRef:"verified-payout-001",termsVersion:"terms-v1",permitsRequired:1});
 assert.equal((await listEvidence(env,id)).documents.length,4);
 await advance("EVALUATION_APPROVED","DOCUMENTATION_VERIFIED");await assert.rejects(advance("DOCUMENTATION_VERIFIED","CONTRACT_VERIFIED"),/DIRECT_CONFORMITY_REQUIRED/);
 const doc=(await listEvidence(env,id)).documents.find(x=>x.kind==="SIGNED_CONTRACT");const contract=await issueAcceptance(env,actor,{id,purpose:"CONTRACT",documentId:doc.id,deliveryRef:"verified-contact-601"});
 assert.equal((await acceptanceView(env,contract.code)).documentId,doc.id);await decideAcceptance(env,contract.code,"ACCEPTED");await assert.rejects(decideAcceptance(env,contract.code,"ACCEPTED"),/INVALID_CODE/);
 await advance("DOCUMENTATION_VERIFIED","CONTRACT_VERIFIED");await advance("CONTRACT_VERIFIED","CONFIGURATION_VERIFIED");await assert.rejects(advance("CONFIGURATION_VERIFIED","READY_FOR_ACTIVATION"),/PROFILE_APPROVAL_REQUIRED/);
 await recordContact(env,actor,{id,channel:"PHONE",outcome:"CONTACTED",notes:"Synthetic contact"});
 const photo=await uploadProfileMedia(env,actor,id,Uint8Array.from([137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82]));
 await editProfile(env,actor,{id,version:"0",operation:"DETAILS",name:"Synthetic shop",description:"",logo:photo,open0:"09:00",close0:"18:00"});
 await assert.rejects(reviewProfile(env,actor,{id,version:"1",decision:"APPROVED",evidence:"synthetic-approval"}),/PROFILE_INCOMPLETE/);
 await editProfile(env,actor,{id,version:"1",operation:"PRODUCT",category:"Synthetic",productName:"Synthetic item",price:"12.50",photo});
 await assert.rejects(editProfile(env,actor,{id,version:"1",operation:"DETAILS",name:"stale"}),/PROFILE_CONFLICT/);
 await reviewProfile(env,actor,{id,version:"2",decision:"APPROVED",evidence:"synthetic-approval"});
 const oldInvite=await issueAcceptance(env,actor,{id,purpose:"PROFILE",deliveryRef:"verified-contact-601"});
 assert.equal((await approvedProfile(env,id)).products[0].priceCents,1250);
 await editProfile(env,actor,{id,version:"2",operation:"DETAILS",name:"Synthetic shop corrected",logo:photo,open0:"09:00",close0:"18:00"});
 await assert.rejects(acceptanceView(env,oldInvite.code),/ACCEPTANCE_STALE/);
 assert.equal(await approvedProfile(env,id),null);await assert.rejects(advance("CONFIGURATION_VERIFIED","READY_FOR_ACTIVATION"),/PROFILE_APPROVAL_REQUIRED/);
 await reviewProfile(env,actor,{id,version:"3",decision:"APPROVED",evidence:"synthetic-approval-v3"});
 await assert.rejects(advance("CONFIGURATION_VERIFIED","READY_FOR_ACTIVATION"),/DIRECT_CONFORMITY_REQUIRED/);
 const invite=await issueAcceptance(env,actor,{id,purpose:"PROFILE",deliveryRef:"verified-contact-602"});const parallel=await issueAcceptance(env,actor,{id,purpose:"PROFILE",deliveryRef:"verified-contact-603"});assert.equal((await acceptanceView(env,invite.code)).profileVersion,3);
 await assert.rejects(acceptanceView(env,invite.code,invite.expires),/INVALID_CODE/);
 const revoked=await issueAcceptance(env,actor,{id,purpose:"PROFILE",deliveryRef:"verified-contact-604"});await revokeAcceptance(env,revoked.id,id);await assert.rejects(acceptanceView(env,revoked.code),/INVALID_CODE/);
 await decideAcceptance(env,invite.code,"ACCEPTED");await assert.rejects(decideAcceptance(env,parallel.code,"CORRECTIONS_REQUIRED"),/INVALID_CODE/);await assert.rejects(issueAcceptance(env,actor,{id,purpose:"PROFILE",deliveryRef:"verified-contact-605"}),/ACCEPTANCE_FINAL/);
 assert.ok((await listAcceptances(env,id)).some(x=>x.decision==="ACCEPTED"&&x.profile_version===3));
 await advance("CONFIGURATION_VERIFIED","READY_FOR_ACTIVATION");
 await assert.rejects(editProfile(env,actor,{id,version:"3",operation:"DETAILS",name:"locked"}),/PROFILE_LOCKED/);
 assert.equal((await merchantAccountSnapshot(env,id)).enabled,false);assert.equal((await merchantAccountSnapshot(env,id)).status,"READY");
 assert.throws(()=>db.exec("UPDATE merchant_accounts SET status='ACTIVE',version=version+1,authorization_ref='forged'"));
 await assert.rejects(uploadDocument(env,actor,{id,kind:"RUC",bytes}),/EVIDENCE_LOCKED/);
 assert.equal(objects.size,5);
 // Real schema and approved evidence; synthetic activation only in this in-memory production fixture.
 db.exec("UPDATE merchant_runtime SET activation_enabled=1,launch_authorization_ref='owner-approval-601'");
 const operational={...env,SERVICE_ORIGIN:PRODUCTION_ORIGIN,ACTIVATION_ENABLED:"true",PRODUCTION_POLICY_VERIFIED:"true",COMMERCIAL_POLICY_VERIFIED:"true",APP_INTEGRATION_ENABLED:"true",LAUNCH_AUTHORIZATION_REF:"owner-approval-601",ACTIVATION_AUTHORIZATION_REF:"account-approval-601"};
 await changeAccountStatus(operational,actor,{id,from:"READY",to:"ACTIVE",version:0,reason:"Synthetic activation",authorization:"account-approval-601"});
 assert.equal((await merchantAccountSnapshot(operational,id)).enabled,true);
 for(const patch of [{ACTIVATION_ENABLED:"false"},{PRODUCTION_POLICY_VERIFIED:"false"},{COMMERCIAL_POLICY_VERIFIED:"false"},{APP_INTEGRATION_ENABLED:"false"},{LAUNCH_AUTHORIZATION_REF:"different-ref"},{SERVICE_ORIGIN:"https://other.invalid"}])assert.equal((await merchantAccountSnapshot({...operational,...patch},id)).enabled,false);
 db.exec("UPDATE merchant_runtime SET activation_enabled=0");
 assert.equal((await merchantAccountSnapshot(operational,id)).enabled,false);
 assert.equal((await merchantAccountSnapshot(operational,id)).status,"ACTIVE");
 db.exec("UPDATE merchant_runtime SET activation_enabled=1");
 await changeAccountStatus(operational,actor,{id,from:"ACTIVE",to:"SUSPENDED",version:1,reason:"Synthetic suspension"});
 assert.equal((await merchantAccountSnapshot(operational,id)).enabled,false);
});
test("Object integrity mismatch prevents verification",async t=>{
 const {objects,env}=fixture(t),bytes=new TextEncoder().encode("%PDF-1.7\nDESSET-SYNTHETIC\n%%EOF");
 const d=await uploadDocument(env,actor,{id,kind:"RUC",bytes});const key=[...objects.keys()][0];const changed=bytes.slice();changed[8]^=1;objects.set(key,changed);
 await assert.rejects(reviewDocument(env,actor,{doc:d.id,decision:"VERIFIED",evidence:"scan-001"}),/DOCUMENT_INTEGRITY/);
});

test("Direct confirmation remains closed without launch authorization",async t=>{const {env}=fixture(t);const r=await handle(new Request(PRODUCTION_ORIGIN+"/conformidad"),{...env,SERVICE_ORIGIN:PRODUCTION_ORIGIN},null);assert.equal(r.status,503);});

test("Manual contact is a real status message, never claims automatic delivery",async t=>{const {env}=fixture(t);const data=await getPreparation(env,id),message=commercialMessage(data.request),page=preparationPage(data,"csrf");assert.match(message.body,/Hemos revisado tu solicitud/);assert.ok(message.body.includes(id));assert.match(page,/Abrir correo para el comercio/);assert.match(page,/no acredita su envío/);assert.match(page,/mailto:/);await recordContact(env,actor,{id,channel:"EMAIL",outcome:"CONTACTED",notes:"Synthetic contact"});assert.equal((await getPreparation(env,id)).contacts.length,1);});
