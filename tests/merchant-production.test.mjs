import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {normalize,verifyAccess,turnstile,handle,notifyOne,STAGING_ORIGIN} from "../internal/merchant-production/worker.mjs";
const origin=STAGING_ORIGIN,env={SERVICE_ORIGIN:origin,ENVIRONMENT:"staging"};
const input={business_name:"Synthetic store",category:"grocery",department:"Lima",province:"Huaura",district:"Huacho",address:"Synthetic address",contact_name:"Synthetic contact",phone:"+51900000000",email:"TEST@example.invalid"};
test("candidate validates allowed fields and rejects extra or malformed data",()=>{assert.equal(normalize(input).email,"test@example.invalid");assert.throws(()=>normalize({...input,dni:"test"}));assert.throws(()=>normalize({...input,phone:"123"}));assert.throws(()=>normalize({...input,observations:"a".repeat(1001)}));});
test("default closed, origin checked, no public admin or SQLite endpoint",async()=>{assert.equal((await handle(new Request(origin+"/admin"),env)).status,503);assert.equal((await handle(new Request(origin+"/api/intake",{method:"POST",headers:{Origin:origin}}),env)).status,503);assert.equal((await handle(new Request(origin+"/api/intake",{method:"POST",headers:{Origin:"https://other.invalid"}}),env)).status,403);assert.equal((await handle(new Request("https://other.invalid/admin"),env)).status,403);assert.equal((await handle(new Request(origin+"/internal/merchant-production/schema.sql"),env)).status,404);});
test("real signature verification rejects tamper, wrong audience, expiry, wrong subject",async()=>{
 const pair=await crypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
 const jwk=await crypto.subtle.exportKey("jwk",pair.publicKey);jwk.kid="test";
 const cfg={ADMIN_POLICY_VERIFIED:"true",ACCESS_ISSUER:"https://test.cloudflareaccess.com",ACCESS_AUD:"a".repeat(64),ADMIN_SUBJECTS:"synthetic-admin"};
 const payload={iss:cfg.ACCESS_ISSUER,aud:[cfg.ACCESS_AUD],exp:1100,iat:900,sub:"synthetic-admin",email:"test@example.invalid",type:"app"};
 const b64=v=>Buffer.from(JSON.stringify(v)).toString("base64url");
 const sign=async p=>{const h=b64({alg:"RS256",kid:"test"})+"."+b64(p);return h+"."+Buffer.from(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",pair.privateKey,new TextEncoder().encode(h))).toString("base64url");};
 const fetcher=async url=>{assert.equal(url,cfg.ACCESS_ISSUER+"/cdn-cgi/access/certs");return Response.json({keys:[jwk]});};
 const req=token=>new Request(origin+"/admin",{headers:{"Cf-Access-Jwt-Assertion":token}});
 const good=await sign(payload);assert.equal(await verifyAccess(req(good),cfg,fetcher,1000),"synthetic-admin");
 for(const p of [{...payload,aud:["wrong"]},{...payload,exp:999},{...payload,sub:"other"},{...payload,nbf:1001},{...payload,type:"service"}])await assert.rejects(verifyAccess(req(await sign(p)),cfg,fetcher,1000),/ACCESS_DENIED/);
 const [h,,sig]=good.split(".");await assert.rejects(verifyAccess(req(h+"."+b64({...payload,email:"fake@example.invalid"})+"."+sig),cfg,fetcher,1000),/ACCESS_DENIED/);
 await assert.rejects(verifyAccess(req(good),{...cfg,ADMIN_POLICY_VERIFIED:"false"},fetcher,1000),/ADMIN_DISABLED/);
});
test("Turnstile validates server-side action and hostname, fails closed",async()=>{const cfg={TURNSTILE_SECRET:"synthetic",TURNSTILE_HOST:"merchant.example.invalid"};const pass={success:true,hostname:cfg.TURNSTILE_HOST,action:"merchant_intake"};await turnstile("token",cfg,async()=>Response.json(pass));for(const v of [{...pass,success:false},{...pass,hostname:"other.invalid"},{...pass,action:"other"}])await assert.rejects(turnstile("token",cfg,async()=>Response.json(v)),/CHALLENGE_INVALID/);await assert.rejects(turnstile("token",cfg,async()=>{throw Error("offline")}),/CHALLENGE_UNAVAILABLE/);});
test("migration schema: durable outbox and audited terminal transition",()=>{
 const db=new DatabaseSync(":memory:");try{db.exec("PRAGMA foreign_keys=ON;");db.exec(readFileSync(new URL("../internal/merchant-production/schema.sql",import.meta.url),"utf8"));
 assert.deepEqual({...db.prepare("SELECT environment,intake_enabled,notification_enabled FROM merchant_runtime").get()},{environment:"staging",intake_enabled:0,notification_enabled:0});
 const ins=db.prepare("INSERT INTO merchant_requests(id,request_key,payload_hash,identity_hash,business_name,category,department,province,district,address,contact_name,phone,email,privacy_version,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) RETURNING id");
 const v=["id1","key1","hash1","identity1",...Object.values(input),"TEST",1];assert.equal(ins.get(...v).id,"id1");assert.equal(db.prepare("SELECT status FROM merchant_notification_outbox WHERE request_id='id1'").get().status,"PENDING");
 assert.throws(()=>ins.get("id2",...v.slice(1)));assert.throws(()=>ins.get("id3","key3",...v.slice(2)));
 db.prepare("UPDATE merchant_requests SET status='APPROVED',reviewed_by='reviewer',reviewed_at=2 WHERE id='id1'").run();assert.equal(db.prepare("SELECT decision FROM merchant_review_events").get().decision,"APPROVED");assert.throws(()=>db.exec("UPDATE merchant_requests SET status='REJECTED' WHERE id='id1'"));
 }finally{db.close();}
});
test("notification worker cannot send while persistent gate disabled",async()=>{let sent=false;const db={prepare(){return {first:async()=>({environment:"staging",notification_enabled:0})}}};assert.equal(await notifyOne({DB:db,ENVIRONMENT:"staging",NOTIFICATIONS_ENABLED:"true",EMAIL:{send(){sent=true;}}}),"DISABLED");assert.equal(sent,false);});
