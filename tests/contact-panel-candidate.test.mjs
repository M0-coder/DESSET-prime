import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {createPanelCandidate} from "../internal/contact-platform/panel-candidate.mjs";
import {candidateHandler} from "../internal/contact-platform/worker.mjs";
import worker from "../internal/contact-platform/worker.mjs";
import {proposedOrigin as origin} from "../internal/contact-platform/gates.mjs";
const now=1700000000000,csrf="c".repeat(64);
const read=p=>readFileSync(new URL("../internal/contact-platform/"+p,import.meta.url),"utf8");
const sample={category:"marketing",person:"Synthetic Person",email:"synthetic1@example.invalid",organization:"Synthetic Org",phone:"",subject:"Synthetic subject",message:"Synthetic <img src=x onerror=alert(1)>",consent:true,privacyVersion:"synthetic-v1",requestKey:"a".repeat(64),challenge:"synthetic-test"};
function fixture(t){
 const db=new DatabaseSync(":memory:");t.after(()=>db.close());db.exec("PRAGMA foreign_keys=ON");db.exec(read("runtime.sql"));db.exec(read("d1-schema.sql"));
 const prepare=sql=>{const s=db.prepare(sql);const wrap=(args=[])=>({first:async()=>s.get(...args)??null,all:async()=>({success:true,results:s.all(...args)}),_execute:()=>({success:true,results:s.columns().length?s.all(...args):(s.run(...args),[])})});return {...wrap(),bind:(...args)=>wrap(args)};};
 const CONTACT_DB={prepare,batch:async ss=>{db.exec("BEGIN IMMEDIATE");try{const x=ss.map(s=>s._execute());db.exec("COMMIT");return x;}catch(e){db.exec("ROLLBACK");throw e;}}};
 const notice="Synthetic test privacy notice, not a real policy. ".repeat(8),hash=createHash("sha256").update(notice).digest("hex");
 const env={ENVIRONMENT:"production",CONTACT_ORIGIN:origin,CONTACT_INTAKE_ENABLED:"true",CONTACT_POLICY_VERIFIED:"true",CONTACT_AUTHORIZATION_REF:"synthetic-approval",CONTACT_PRIVACY_VERSION:"synthetic-v1",CONTACT_PRIVACY_SHA256:hash,CONTACT_PRIVACY_NOTICE:notice,CONTACT_DB,CONTACT_LIMIT:{},CONTACT_TURNSTILE_SECRET:"synthetic",CONTACT_RETENTION_DAYS:"7",CONTACT_CAPACITY:"500",CONTACT_ADMIN_ENABLED:"true",CONTACT_PANEL_ENABLED:"true"};
 db.prepare("UPDATE contact_runtime SET environment='production',intake_enabled=1,privacy_version=?,privacy_sha256=?,authorization_ref=?").run(env.CONTACT_PRIVACY_VERSION,hash,env.CONTACT_AUTHORIZATION_REF);
 let active=true,token=csrf,at=now,calls=0;
 const authorize=async r=>{calls++;if(!active||r.headers.get("Authorization")!=="Synthetic admin")throw Object.assign(Error(),{status:403});return {actor:"synthetic-admin",categories:["marketing"],csrf:token};};
 const handle=createPanelCandidate({authorize,now:()=>at});
 const api=candidateHandler({now:()=>now,limit:async()=>true,challenge:async()=>true,authorize});
 const seed=async(d=sample)=>{const response=await api(new Request(origin+"/api/contact",{method:"POST",headers:{Origin:origin,"Content-Type":"application/json"},body:JSON.stringify(d)}),env,{});assert.equal(response.status,201);return (await response.json()).id;};
 const get=(path,auth=true,e=env,host=origin)=>handle(new Request(host+path,{headers:auth?{Authorization:"Synthetic admin"}:{}}),e,{});
 const post=(id,state="IN_REVIEW",version=0,opts={})=>handle(new Request(origin+"/panel/transition",{method:"POST",headers:{Authorization:"Synthetic admin",Origin:origin,"Content-Type":"application/x-www-form-urlencoded",...opts.headers},body:opts.body??new URLSearchParams({id,state,version:String(version),csrf:opts.csrf??csrf})}),env,{});
 return {db,env,seed,get,post,revoke:()=>{active=false;},rotate:()=>{token="d".repeat(64);},expire:()=>{at=now+7*86400000;},calls:()=>calls};
}
test("panel is closed without explicit flags; authentication precedes D1 access",async t=>{
 const f=fixture(t);assert.equal((await f.get("/panel",true,{...f.env,CONTACT_PANEL_ENABLED:"false"})).status,503);assert.equal(f.calls(),0);
 assert.equal((await f.get("/panel",true,{...f.env,CONTACT_ADMIN_ENABLED:"false"})).status,503);
 assert.equal((await f.get("/panel",true,f.env,"https://wrong.invalid")).status,403);assert.equal(f.calls(),0);
 assert.equal((await f.get("/panel",false)).status,403);
 const locked=await worker.fetch(new Request(origin+"/panel"),f.env,{});assert.equal(locked.status,503);
});
test("D1 departmental queue is minimized and details are escaped",async t=>{
 const f=fixture(t),id=await f.seed(),other=await f.seed({...sample,category:"legal",requestKey:"b".repeat(64)});
 const q=await f.get("/panel");assert.equal(q.status,200);assert.equal(q.headers.get("Cache-Control"),"no-store");assert.match(q.headers.get("Content-Security-Policy"),/frame-ancestors 'none'/);
 const html=await q.text();assert.ok(html.includes(id));assert.ok(!html.includes(other));assert.ok(!html.includes(sample.email));
 assert.equal((await f.get("/panel?category=legal")).status,403);assert.equal((await f.get("/panel/request/"+other)).status,404);
 const d=await (await f.get("/panel/request/"+id)).text();assert.ok(d.includes("&lt;img src=x onerror=alert(1)&gt;"));assert.ok(!d.includes("<img src=x"));assert.ok(d.includes("Iniciar revisión"));
});
test("CSRF, cross-origin, duplicate fields and oversized bodies fail closed",async t=>{
 const f=fixture(t),id=await f.seed();
 for(const opts of [{csrf:"bad"},{headers:{Origin:"null"}},{headers:{"Sec-Fetch-Site":"cross-site"}},{body:"id="+id+"&id="+id+"&state=IN_REVIEW&version=0&csrf="+csrf},{body:"x".repeat(3000)}])assert.equal((await f.post(id,"IN_REVIEW",0,opts)).status,403);
 assert.equal(f.db.prepare("SELECT count(*) n FROM contact_events").get().n,0);
});
test("D1 transitions are versioned and atomic with audited rollback",async t=>{
 const f=fixture(t),id=await f.seed();const moved=await f.post(id);assert.equal(moved.status,303);assert.equal(moved.headers.get("Location"),"/panel/request/"+id);
 assert.equal((await f.post(id)).status,409);
 f.db.exec("CREATE TRIGGER deny_audit BEFORE INSERT ON contact_events BEGIN SELECT RAISE(ABORT,'test rollback'); END;");
 assert.equal((await f.post(id,"CLOSED",1)).status,503);assert.equal(f.db.prepare("SELECT state FROM contact_requests WHERE id=?").get(id).state,"IN_REVIEW");
 f.db.exec("DROP TRIGGER deny_audit");assert.equal((await f.post(id,"CLOSED",1)).status,303);assert.equal(f.db.prepare("SELECT count(*) n FROM contact_events").get().n,2);
 assert.match(await (await f.get("/panel/request/"+id)).text(),/Consulta cerrada/);
});
test("identity is checked each request; rotated CSRF, expired records and revocation denied",async t=>{
 const f=fixture(t),id=await f.seed();assert.equal((await f.get("/panel/request/"+id)).status,200);f.rotate();assert.equal((await f.post(id)).status,403);
 f.expire();assert.equal((await f.get("/panel/request/"+id)).status,404);f.revoke();assert.equal((await f.get("/panel")).status,403);
});
