import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import worker,{handle,normalizeComplete,submit,advanceOnboarding,STAGING_ORIGIN} from "../internal/merchant-production/worker.mjs";
import {territoryCounts,resolveTerritory,territoryByCode,departments,provinces,districtsFor,catalogEvidence} from "../internal/merchant-common/territory.mjs";
const input={business_name:"Synthetic shop",category:"restaurant",department:"Lima",province:"Huaura",district:"Huacho",address:"Synthetic address",contact_name:"Synthetic person",phone:"+51900000000",email:"Synthetic@example.invalid",postal_code:"15136",interest_level:"evaluating",contact_pronunciation:"Synthetic name",observations:"Synthetic note"};
const sql=name=>readFileSync(new URL("../internal/merchant-production/"+name,import.meta.url),"utf8");
const id="00000000-0000-4000-8000-000000000099";
function dbFixture(t,legacy=false){
 const db=new DatabaseSync(":memory:");t.after(()=>db.close());db.exec("PRAGMA foreign_keys=ON");db.exec(sql("schema.sql"));
 if(legacy)db.prepare("INSERT INTO merchant_requests(id,request_key,payload_hash,identity_hash,business_name,category,department,province,district,address,contact_name,phone,email,privacy_version,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(id,"legacy-key","legacy-hash","legacy-identity","Synthetic old","restaurant","Lima","Huaura","Huacho","Synthetic old","Synthetic person","+51900000000","old@example.invalid","TEST-v1",1);
 db.exec(sql("migrations/0002-merchant-integration.sql"));
 const DB={prepare(q){const s=db.prepare(q),wrap=args=>({first:async()=>s.get(...args)??null,all:async()=>({results:s.all(...args)}),run:async()=>({meta:{changes:s.run(...args).changes}})});return {...wrap([]),bind:(...args)=>wrap(args)};}};
 const env={DB,ENVIRONMENT:"staging",SERVICE_ORIGIN:STAGING_ORIGIN,PRIVACY_VERSION:"TEST-v1",TURNSTILE_SECRET:"synthetic",TURNSTILE_HOST:"synthetic.invalid",INTAKE_ENABLED:"true",INTAKE_LIMIT:{limit:async()=>({success:true})}};
 const fetcher=async u=>{assert.equal(u,"https://challenges.cloudflare.com/turnstile/v0/siteverify");return Response.json({success:true,hostname:env.TURNSTILE_HOST,action:"merchant_intake"});};
 return {db,env,fetcher};
}
const request=(data=input,key="synthetic-key-000000001")=>new Request(STAGING_ORIGIN+"/api/intake",{method:"POST",headers:{"Content-Type":"application/json","CF-Connecting-IP":"192.0.2.10",Origin:STAGING_ORIGIN},body:JSON.stringify({input:data,requestKey:key,privacyVersion:"TEST-v1",consent:true,turnstileToken:"synthetic-token"})});
test("Territory candidate hierarchy, leading zeroes and explicit source limitation",()=>{
 assert.deepEqual(territoryCounts,{departments:25,provinces:196,districts:1893});assert.equal(catalogEvidence.independentlyVerified,false);
 assert.equal(resolveTerritory("Lima","Huaura","Huacho").ubigeo,"150801");
 assert.match(territoryByCode("120307").district,/sangani/i);
 assert.match(territoryByCode("160405").district,/santa rosa/i);
 assert.equal(departments().length,25);assert.equal(departments()[0].code,"01");
 assert.ok(provinces("15").some(x=>x.code==="1508"));assert.ok(districtsFor("1508").some(x=>x.code==="150801"));
 assert.throws(()=>resolveTerritory("Lima","Huaura","Miraflores"),/INVALID_LOCATION/);assert.throws(()=>territoryByCode("000000"),/INVALID_LOCATION/);
});
test("Additive migration preserves legacy hashes, outbox and closed defaults",t=>{
 const {db}=dbFixture(t,true),r=db.prepare("SELECT payload_hash,postal_code,interest_level,contact_pronunciation,ubigeo FROM merchant_requests WHERE id=?").get(id);
 assert.deepEqual({...r},{payload_hash:"legacy-hash",postal_code:null,interest_level:null,contact_pronunciation:null,ubigeo:null});
 assert.equal(db.prepare("SELECT count(*) n FROM merchant_notification_outbox").get().n,1);assert.equal(db.prepare("SELECT activation_enabled FROM merchant_runtime").get().activation_enabled,0);
 for(const [c,v] of [["postal_code","123"],["interest_level","unknown"],["ubigeo","abcdef"]])assert.throws(()=>db.prepare("UPDATE merchant_requests SET "+c+"=? WHERE id=?").run(v,id));
 assert.equal(db.prepare("PRAGMA integrity_check").get().integrity_check,"ok");
});
test("D1 adapter full field persistence, replay, conflict and closed HTTP",async t=>{
 const {db,env,fetcher}=dbFixture(t);
 assert.equal(normalizeComplete(input).ubigeo,"150801");
 for(const ch of [{postal_code:undefined},{interest_level:undefined},{district:"Miraflores"},{email_confirm:"x"}])assert.throws(()=>normalizeComplete({...input,...ch}));
 await assert.rejects(submit(request(),env,fetcher),/INTAKE_DISABLED/);db.exec("UPDATE merchant_runtime SET intake_enabled=1,privacy_version='TEST-v1'");
 assert.equal((await handle(request(),env)).status,503);
 const r=await submit(request(),env,fetcher);assert.equal(r.status,201);const result=await r.json(),row=db.prepare("SELECT * FROM merchant_requests WHERE id=?").get(result.id);
 for(const k of ["postal_code","interest_level","contact_pronunciation","observations"])assert.equal(row[k],input[k]);
 assert.equal(row.ubigeo,"150801");assert.equal(row.email,"synthetic@example.invalid");assert.ok(!Object.hasOwn(row,"email_confirm"));
 assert.equal(db.prepare("SELECT count(*) n FROM merchant_notification_outbox").get().n,1);
 assert.equal((await (await submit(request(),env,fetcher)).json()).id,result.id);
 await assert.rejects(submit(request({...input,observations:"Synthetic changed"}),env,fetcher),/REQUEST_CONFLICT/);
 await assert.rejects(submit(request(input,"synthetic-key-000000002"),env,fetcher),/REQUEST_CONFLICT/);
 assert.equal(db.prepare("SELECT count(*) n FROM merchant_requests").get().n,1);assert.equal(typeof worker.scheduled,"function");
});
test("Approval is not activation: ordered, audited synthetic progression",async t=>{
 const {db,env}=dbFixture(t,true);
 db.prepare("UPDATE merchant_requests SET status='APPROVED',reviewed_by='synthetic-owner',reviewed_at=2 WHERE id=?").run(id);
 assert.equal(db.prepare("SELECT stage FROM merchant_onboarding WHERE request_id=?").get(id).stage,"EVALUATION_APPROVED");
 const actor="synthetic-owner",evidence="SYNTHETIC-DOC-001";
 await assert.rejects(advanceOnboarding(env,actor,{id,from:"EVALUATION_APPROVED",to:"CONTRACT_VERIFIED",evidence}),/INVALID_ONBOARDING/);
 const steps=["EVALUATION_APPROVED","DOCUMENTATION_VERIFIED","CONTRACT_VERIFIED","CONFIGURATION_VERIFIED","READY_FOR_ACTIVATION"];
 for(let i=0;i<steps.length-1;i++){const d={id,from:steps[i],to:steps[i+1],evidence};assert.equal((await advanceOnboarding(env,actor,d)).stage,steps[i+1]);await assert.rejects(advanceOnboarding(env,actor,d),/ONBOARDING_CONFLICT/);}
 assert.equal(db.prepare("SELECT count(*) n FROM merchant_onboarding_events").get().n,4);
 await assert.rejects(advanceOnboarding(env,actor,{id,from:steps.at(-1),to:"ACTIVE",evidence}),/INVALID_ONBOARDING/);
 assert.equal(db.prepare("SELECT activation_enabled FROM merchant_runtime").get().activation_enabled,0);
});
