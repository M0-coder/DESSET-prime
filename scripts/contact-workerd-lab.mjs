import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {resolve} from "node:path";
const {Miniflare}=createRequire(resolve(process.env.CONTACT_LAB_PREFIX,"package.json"))("miniflare");
const origin="https://contacto.desset.lat", now=1700000000000;
const notice="Synthetic test notice, not an approved privacy policy. ".repeat(8);
const hash=createHash("sha256").update(notice).digest("hex");
const bindings={LAB_ONLY:"synthetic-local-only",ENVIRONMENT:"production",CONTACT_ORIGIN:origin,CONTACT_INTAKE_ENABLED:"true",CONTACT_POLICY_VERIFIED:"true",CONTACT_AUTHORIZATION_REF:"synthetic-approval",CONTACT_PRIVACY_VERSION:"synthetic-v1",CONTACT_PRIVACY_SHA256:hash,CONTACT_PRIVACY_NOTICE:notice,CONTACT_LIMIT:{},CONTACT_TURNSTILE_SECRET:"synthetic",CONTACT_RETENTION_DAYS:"7",CONTACT_CAPACITY:"500",CONTACT_ADMIN_ENABLED:"true"};
const mf=new Miniflare({host:"127.0.0.1",port:0,cf:false,modules:true,modulesRoot:process.cwd(),scriptPath:"scripts/contact-workerd-fixture.mjs",compatibilityDate:"2025-11-01",d1Databases:{CONTACT_DB:"synthetic-local-contact"},d1Persist:false,bindings,outboundService:()=>new Response("External network denied",{status:503})});
const sample={category:"marketing",person:"Synthetic Person",email:"test@example.invalid",organization:"Synthetic Organization",phone:"",subject:"Synthetic subject",message:"Synthetic message",consent:true,privacyVersion:"synthetic-v1",requestKey:"a".repeat(64),challenge:"synthetic-test"};
const auth={Authorization:"Synthetic admin","X-CSRF-Token":"c".repeat(64)};
const call=(path,method="GET",data,headers={})=>mf.dispatchFetch(origin+path,{method,headers:{...(method==="POST"?{Origin:origin,"Content-Type":"application/json"}:{}),...headers},...(data===undefined?{}:{body:JSON.stringify(data)})});
const submit=(data=sample)=>call("/api/contact","POST",data);
const checks=[];const pass=name=>{checks.push(name);console.log("PASS "+name);};
function migration(file){
 const sql=readFileSync(resolve("internal/contact-platform",file),"utf8");
 const parts=[];let buffer="";
 for(const line of sql.split("\n")){if(!line.trim()||line.trimStart().startsWith("--"))continue;buffer+=line+"\n";const trigger=/^CREATE TRIGGER/i.test(buffer.trim());if(trigger?/END;\s*$/i.test(line):/;\s*$/.test(line)){parts.push(buffer.trim());buffer="";}}
 assert.equal(buffer.trim(),"");return parts;
}
try{
 const db=await mf.getD1Database("CONTACT_DB");
 for(const file of ["runtime.sql","d1-schema.sql"]){const statements=migration(file);const result=await db.batch(statements.map(s=>db.prepare(s)));assert.equal(result.length,statements.length);assert(result.every(x=>x.success));}
 const count=async table=>Number((await db.prepare("SELECT count(*) AS n FROM "+table).first()).n);
 const enable=()=>db.prepare("UPDATE contact_runtime SET environment='production',intake_enabled=1,privacy_version=?,privacy_sha256=?,authorization_ref=? WHERE id=1").bind(bindings.CONTACT_PRIVACY_VERSION,hash,bindings.CONTACT_AUTHORIZATION_REF).run();
 assert.equal((await submit()).status,503);assert.equal(await count("contact_requests"),0);pass("local D1 migrations and closed default runtime");
 await enable();assert.equal((await call("/__locked","POST",sample)).status,503);assert.equal(await count("contact_requests"),0);pass("actual Worker default export remains locked");
 const replay=await Promise.all(Array.from({length:8},()=>submit()));
 assert.equal(replay.filter(x=>x.status===201).length,1);assert.equal(replay.filter(x=>x.status===200).length,7);
 const receipts=await Promise.all(replay.map(x=>x.json()));const id=receipts[0].id;assert(receipts.every(x=>x.id===id&&Object.keys(x).sort().join(",")==="id,replayed"));assert.equal(await count("contact_requests"),1);
 assert.equal((await submit({...sample,message:"Synthetic conflict"})).status,409);pass("concurrent idempotency and conflicting replay");
 const other=await submit({...sample,category:"legal",requestKey:"b".repeat(64)});assert.equal(other.status,201);const otherId=(await other.json()).id;
 assert.equal((await call("/admin/request/"+id)).status,403);assert.equal((await call("/admin/request/"+otherId,"GET",undefined,auth)).status,404);
 const q=await call("/admin/queue?category=marketing","GET",undefined,auth);assert.equal(q.status,200);const items=(await q.json()).items;assert.equal(items.length,1);assert.equal(items[0].email,undefined);pass("department isolation and minimized queue");
 const move=(state,version,headers=auth)=>call("/admin/transition","POST",{id,state,version},headers);
 assert.equal((await move("IN_REVIEW",0,{Authorization:"Synthetic admin"})).status,403);
 const concurrent=await Promise.all([move("IN_REVIEW",0),move("IN_REVIEW",0)]);
 assert.deepEqual(concurrent.map(x=>x.status).sort(),[200,409]);assert.equal(await count("contact_events"),1);pass("concurrent optimistic transitions and CSRF");
 await db.prepare("INSERT INTO contact_events(request_id,version,actor,from_state,to_state,at) VALUES(?,2,'synthetic-block','IN_REVIEW','CLOSED',?)").bind(id,now).run();
 assert.equal((await move("CLOSED",1)).status,503);
 assert.equal((await db.prepare("SELECT state,version FROM contact_requests WHERE id=?").bind(id).first()).state,"IN_REVIEW");
 await db.prepare("DELETE FROM contact_events WHERE request_id=? AND version=2").bind(id).run();
 assert.equal((await move("CLOSED",1)).status,200);assert.equal(await count("contact_events"),2);pass("trigger failure rolls back state; audit atomic");
 assert.equal((await submit({...sample,requestKey:"d".repeat(64),challenge:"kill-switch"})).status,503);assert.equal(await count("contact_requests"),2);pass("kill switch at transaction boundary");
 const purge=await call("/__purge");assert.equal(purge.status,200);assert.equal((await purge.json()).deleted,2);assert.equal(await count("contact_requests"),0);assert.equal(await count("contact_events"),0);pass("local deletion count excludes cascade and all events removed");
 // 101 expired requests plus one still valid; enforce the per-call bound and no early purge.
 const expiry=now+7*86400000;
 const seeded=await db.prepare("WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM seq WHERE n<102) INSERT INTO contact_requests(id,request_key,payload_hash,category,person,email,organization,phone,subject,message,privacy_version,privacy_sha256,authorization_ref,created_at,expires_at) SELECT printf('00000000-0000-4000-8000-%012d',n),printf('%064d',n),?,'marketing','Synthetic Person','test@example.invalid','','','Synthetic subject','Synthetic message',?,?,?, ?,?+CASE WHEN n=102 THEN 1 ELSE 0 END FROM seq").bind(hash,bindings.CONTACT_PRIVACY_VERSION,hash,bindings.CONTACT_AUTHORIZATION_REF,now,expiry).run();
 assert.equal(seeded.success,true);assert.equal(await count("contact_requests"),102);
 for(const [expected,remaining] of [[100,2],[1,1],[0,1]]){const p=await call("/__purge");assert.equal(p.status,200);assert.equal((await p.json()).deleted,expected);assert.equal(await count("contact_requests"),remaining);}
 assert.equal((await db.prepare("SELECT expires_at FROM contact_requests").first()).expires_at,expiry+1);pass("100-request purge bound and unexpired record preserved");
 console.log(JSON.stringify({status:"PASS",checks,scope:"workerd local D1, synthetic identity/challenge/limit; no hosted resources"}));
}finally{await mf.dispose();}
