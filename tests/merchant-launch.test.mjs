import test from "node:test";import assert from "node:assert/strict";import {DatabaseSync} from "node:sqlite";import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {handle,notifyOne,scheduledNotifications,PRODUCTION_ORIGIN,STAGING_ORIGIN} from "../internal/merchant-production/worker.mjs";
import {loadMerchantUI} from "../internal/merchant-production/build-worker.mjs";
function fixture(t){
 const db=new DatabaseSync(":memory:");t.after(()=>db.close());db.exec("PRAGMA foreign_keys=ON");
 for(const file of ["schema.sql","migrations/0002-merchant-integration.sql","migrations/0003-merchant-drafts.sql","migrations/0004-merchant-operations.sql","migrations/0005-merchant-launch.sql"])db.exec(readFileSync(new URL("../internal/merchant-production/"+file,import.meta.url),"utf8"));
 db.exec("UPDATE merchant_runtime SET environment='production',privacy_version='v1',launch_authorization_ref='owner-approval-001'");
 const DB={prepare(sql){const s=db.prepare(sql),wrap=args=>({first:async()=>s.get(...args)??null,all:async()=>({results:s.all(...args)}),run:async()=>({meta:{changes:s.run(...args).changes}})});return {...wrap([]),bind:(...args)=>wrap(args)};}};
 const notice="Synthetic test notice only. ".repeat(12);let sent=0;const env={DB,ENVIRONMENT:"production",SERVICE_ORIGIN:PRODUCTION_ORIGIN,INTAKE_ENABLED:"true",NOTIFICATIONS_ENABLED:"true",PRODUCTION_POLICY_VERIFIED:"true",PRIVACY_POLICY_VERIFIED:"true",TERRITORY_VERIFIED:"true",PRIVACY_VERSION:"v1",PRIVACY_URL:PRODUCTION_ORIGIN+"/privacidad-comercios.html",PRIVACY_NOTICE:notice,PRIVACY_NOTICE_SHA256:createHash("sha256").update(notice).digest("hex"),LAUNCH_AUTHORIZATION_REF:"owner-approval-001",TURNSTILE_SECRET:"synthetic",TURNSTILE_HOST:"comercios.desset.lat",TURNSTILE_SITE_KEY:"synthetic-site-key",INTAKE_LIMIT:{limit:async()=>({success:true})},EMAIL:{send:async()=>{sent++;return {messageId:"synthetic-message"};}},NOTIFY_FROM:"from@example.invalid",NOTIFY_TO:"to@example.invalid"};
 const fetcher=async()=>Response.json({success:true,hostname:"comercios.desset.lat",action:"merchant_intake"});
 return {db,env,fetcher,sent:()=>sent};
}
const ui=loadMerchantUI();
const input={business_name:"Test restaurant",category:"restaurant",department:"Lima",province:"Huaura",district:"Huacho",address:"Test address",contact_name:"Test person",phone:"+51900000000",email:"test@example.test",email_confirm:"TEST@example.test",postal_code:"15136",interest_level:"evaluating",consent:"yes"};
function request(path,method="GET",data,cookie,origin=PRODUCTION_ORIGIN){return new Request(origin+path,{method,headers:{"CF-Connecting-IP":"192.0.2.1",...(method==="POST"?{Origin:origin,"Content-Type":"application/x-www-form-urlencoded"}:{}),...(cookie?{Cookie:cookie}:{})},...(data?{body:new URLSearchParams(data)}:{})});}
test("Production defaults closed; wrong DB, host, approval or privacy cannot open",async t=>{
 const f=fixture(t),get=e=>handle(request("/registro-comercios.html"),e,null,f.fetcher,undefined,ui);
 assert.equal((await get(f.env)).status,503);
 f.db.exec("UPDATE merchant_runtime SET intake_enabled=1");
 for(const patch of [{INTAKE_ENABLED:"false"},{LAUNCH_AUTHORIZATION_REF:"wrong-ref"},{TERRITORY_VERIFIED:"false"},{PRIVACY_POLICY_VERIFIED:"false"},{PRIVACY_VERSION:"other"},{PRIVACY_NOTICE:"tampered"},{PRIVACY_NOTICE_SHA256:"0".repeat(64)},{SERVICE_ORIGIN:STAGING_ORIGIN}])assert.ok([403,503].includes((await get({...f.env,...patch})).status));
 f.db.exec("UPDATE merchant_runtime SET environment='staging'");assert.equal((await get(f.env)).status,503);
});
test("Authorized production browser form, challenge, edit, receipt, replay and emergency stop",async t=>{
 const f=fixture(t);f.db.exec("UPDATE merchant_runtime SET intake_enabled=1");
 const invoke=(r,e=f.env)=>handle(r,e,null,f.fetcher,undefined,ui);
 const page=await invoke(request("/registro-comercios.html"));assert.equal(page.status,200);const cookie=page.headers.get("set-cookie").split(";")[0],html=await page.text(),csrf=html.match(/name="csrf" value="([a-f0-9]{64})"/)[1];
 assert.match(page.headers.get("set-cookie"),/HttpOnly; SameSite=Strict/);assert.match(html,/cf-turnstile/);assert.match(html,/href="https:\/\/desset\.lat\/comercios\.html"/);assert.match(html,/href="https:\/\/comercios\.desset\.lat\/privacidad-comercios\.html"/);const privacy=await invoke(request("/privacidad-comercios.html"));assert.equal(privacy.status,200);assert.match(await privacy.text(),/Synthetic test notice only/);assert.equal((await invoke(request("/privacidad-comercios.html"),{...f.env,PRIVACY_NOTICE_SHA256:"0".repeat(64)})).status,503);assert.doesNotMatch(html,/Entorno privado de ensayo/);
 const confirm=()=>invoke(request("/merchant/confirm","POST",{...input,csrf,"cf-turnstile-response":"test"},cookie));
 const c=await confirm();assert.equal(c.status,200);const draft=(await c.text()).match(/name="draft" value="([a-f0-9]{64})"/)[1];
 assert.equal(f.db.prepare("SELECT count(*) n FROM merchant_requests").get().n,0);
 assert.equal((await invoke(request("/merchant/submit","POST",{draft,csrf}))).status,403);
 const edit=await invoke(request("/merchant/edit","POST",{draft,csrf},cookie));assert.equal(edit.status,200);
 const c2=await confirm(),d2=(await c2.text()).match(/name="draft" value="([a-f0-9]{64})"/)[1];
 f.db.exec("UPDATE merchant_runtime SET intake_enabled=0");assert.equal((await invoke(request("/merchant/submit","POST",{draft:d2,csrf},cookie))).status,503);
 f.db.exec("UPDATE merchant_runtime SET intake_enabled=1");const receipt=await invoke(request("/merchant/submit","POST",{draft:d2,csrf},cookie));assert.equal(receipt.status,201);assert.match(await receipt.text(),/Solicitud recibida/);
 assert.equal((await invoke(request("/merchant/submit","POST",{draft:d2,csrf},cookie))).status,200);assert.equal(f.db.prepare("SELECT count(*) n FROM merchant_requests").get().n,1);
 assert.equal(f.db.prepare("SELECT payload_json FROM merchant_drafts").get().payload_json,null);
 assert.equal((await invoke(request("/admin","GET",null,cookie))).status,503);
});
test("Cron sends only authorized production outbox, never staging",async t=>{
 const f=fixture(t);f.db.prepare("INSERT INTO merchant_requests(id,request_key,payload_hash,identity_hash,business_name,category,department,province,district,address,contact_name,phone,email,privacy_version,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run("00000000-0000-4000-8000-000000000401","synthetic-key","hash","identity","Test shop","restaurant","Lima","Huaura","Huacho","Test address","Test contact","+51900000000","test@example.test","v1",1);
 assert.deepEqual(await scheduledNotifications(f.env),{processed:0});f.db.exec("UPDATE merchant_runtime SET notification_enabled=1");
 assert.deepEqual(await scheduledNotifications({...f.env,ENVIRONMENT:"staging"}),{processed:0});assert.equal(f.sent(),0);
 assert.deepEqual(await scheduledNotifications(f.env),{processed:1});assert.equal(f.sent(),1);
 assert.deepEqual(await scheduledNotifications(f.env),{processed:0});assert.equal(f.sent(),1);
});

test("Uncertain provider result is quarantined and never blindly retried",async t=>{
 const f=fixture(t);f.db.prepare("INSERT INTO merchant_requests(id,request_key,payload_hash,identity_hash,business_name,category,department,province,district,address,contact_name,phone,email,privacy_version,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run("00000000-0000-4000-8000-000000000402","synthetic-key","hash","identity","Test shop","restaurant","Lima","Huaura","Huacho","Test address","Test contact","+51900000000","test@example.test","v1",1);
 f.db.exec("UPDATE merchant_runtime SET notification_enabled=1");let calls=0;const e={...f.env,EMAIL:{send:async()=>{calls++;throw Error("ambiguous synthetic provider");}}};
 assert.equal(await notifyOne(e),"NEEDS_REVIEW");assert.equal(await notifyOne(e),"EMPTY");assert.equal(calls,1);
 assert.equal(f.db.prepare("SELECT status FROM merchant_notification_outbox").get().status,"NEEDS_REVIEW");
});
