import test from "node:test";import assert from "node:assert/strict";import {DatabaseSync} from "node:sqlite";import {readFileSync} from "node:fs";
import {uploadDocument,reviewDocument,downloadDocument,saveConfiguration,listEvidence,merchantAccountSnapshot} from "../internal/merchant-production/evidence.mjs";
import {advanceOnboarding} from "../internal/merchant-production/worker.mjs";
const id="00000000-0000-4000-8000-000000000601",actor="reviewer";
function fixture(t){
 const db=new DatabaseSync(":memory:");t.after(()=>db.close());db.exec("PRAGMA foreign_keys=ON");
 for(const f of ["schema.sql","migrations/0002-merchant-integration.sql","migrations/0003-merchant-drafts.sql","migrations/0004-merchant-operations.sql","migrations/0005-merchant-launch.sql","migrations/0006-merchant-evidence.sql"])db.exec(readFileSync(new URL("../internal/merchant-production/"+f,import.meta.url),"utf8"));
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
 await advance("EVALUATION_APPROVED","DOCUMENTATION_VERIFIED");await advance("DOCUMENTATION_VERIFIED","CONTRACT_VERIFIED");await advance("CONTRACT_VERIFIED","CONFIGURATION_VERIFIED");await advance("CONFIGURATION_VERIFIED","READY_FOR_ACTIVATION");
 assert.equal((await merchantAccountSnapshot(env,id)).enabled,false);assert.equal((await merchantAccountSnapshot(env,id)).status,"READY");
 assert.throws(()=>db.exec("UPDATE merchant_accounts SET status='ACTIVE',version=version+1,authorization_ref='forged'"));
 await assert.rejects(uploadDocument(env,actor,{id,kind:"RUC",bytes}),/EVIDENCE_LOCKED/);
 assert.equal(objects.size,4);
});
test("Object integrity mismatch prevents verification",async t=>{
 const {objects,env}=fixture(t),bytes=new TextEncoder().encode("%PDF-1.7\nDESSET-SYNTHETIC\n%%EOF");
 const d=await uploadDocument(env,actor,{id,kind:"RUC",bytes});const key=[...objects.keys()][0];const changed=bytes.slice();changed[8]^=1;objects.set(key,changed);
 await assert.rejects(reviewDocument(env,actor,{doc:d.id,decision:"VERIFIED",evidence:"scan-001"}),/DOCUMENT_INTEGRITY/);
});
