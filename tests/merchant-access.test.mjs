import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {readFileSync} from "node:fs";
import worker,{handle,STAGING_ORIGIN} from "../internal/merchant-production/worker.mjs";
const now=1800000000, id="00000000-0000-4000-8000-000000000077";
const email="reviewer@example.invalid",sub="synthetic-reviewer",aud="a".repeat(64),issuer="https://test.cloudflareaccess.com";
const cfg={ENVIRONMENT:"staging",SERVICE_ORIGIN:STAGING_ORIGIN,ADMIN_POLICY_VERIFIED:"true",ACCESS_ISSUER:issuer,ACCESS_AUD:aud,ADMIN_SUBJECTS:sub,ADMIN_EMAIL:email};
const payload={iss:issuer,aud:[aud],exp:now+300,iat:now-30,sub,email,type:"app"};
const pair=await crypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
const jwk=await crypto.subtle.exportKey("jwk",pair.publicKey);jwk.kid="test";
const b64=v=>Buffer.from(JSON.stringify(v)).toString("base64url");
async function sign(p=payload,h={alg:"RS256",kid:"test"}){const a=b64(h)+"."+b64(p);return a+"."+Buffer.from(await crypto.subtle.sign("RSASSA-PKCS1-v1_5",pair.privateKey,new TextEncoder().encode(a))).toString("base64url");}
const token=await sign();
const fetcher=async url=>{assert.equal(url,issuer+"/cdn-cgi/access/certs");return Response.json({keys:[jwk]});};
const context={access:{aud,getIdentity:async()=>({email})}};
const request=(path="/admin",opts={})=>new Request((opts.origin??STAGING_ORIGIN)+path,{method:opts.method??"GET",headers:{...(opts.token===null?{}:{"Cf-Access-Jwt-Assertion":opts.token??token}),...opts.headers},body:opts.body});
const invoke=(req,env=cfg,ctx=context,f=fetcher)=>handle(req,env,ctx,f,now);
function fixture(t){
 const db=new DatabaseSync(":memory:");t.after(()=>db.close());db.exec("PRAGMA foreign_keys=ON;");db.exec(readFileSync(new URL("../internal/merchant-production/schema.sql",import.meta.url),"utf8"));
 db.prepare("INSERT INTO merchant_requests(id,request_key,payload_hash,identity_hash,business_name,category,department,province,district,address,contact_name,phone,email,observations,privacy_version,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)").run(id,"synthetic-key","hash","identity","Synthetic <shop>","grocery","Lima","Huaura","Huacho","Synthetic address","Synthetic contact","+51900000000","synthetic@example.invalid","<script>bad</script>","TEST-v1",now);
 let reads=0;
 const DB={prepare(sql){reads++;const stmt=db.prepare(sql);const wrap=args=>({first:async()=>stmt.get(...args)??null,all:async()=>({results:stmt.all(...args)}),run:async()=>({meta:{changes:stmt.run(...args).changes}})});return {...wrap([]),bind:(...args)=>wrap(args)};}};
 return {db,env:{...cfg,DB},reads:()=>reads};
}
test("valid signed JWT alone cannot reach data without native Access context",async t=>{
 const f=fixture(t);
 for(const ctx of [null,{}, {access:{aud:"b".repeat(64),getIdentity:async()=>({email})}}, {access:{aud}}]){
  const r=await invoke(request(),f.env,ctx);assert.equal(r.status,403);
 }
 assert.equal(f.reads(),0);
});
test("missing, malformed, expired, wrong audience/issuer/subject and service token denied before DB",async t=>{
 const f=fixture(t);
 const candidates=[null,"not.a.jwt",await sign({...payload,exp:now-1}),await sign({...payload,aud:["b".repeat(64)]}),await sign({...payload,iss:"https://other.cloudflareaccess.com"}),await sign({...payload,sub:"other"}),await sign({...payload,type:"service"}),await sign({...payload,exp:now+1800}),await sign({...payload,iat:now+60}),await sign(payload,{alg:"none",kid:"test"}),await sign({...payload,email:123})];
 for(const candidate of candidates)assert.equal((await invoke(request("/admin",{token:candidate}),f.env)).status,403);
 assert.equal(f.reads(),0);
});
test("key fetch failure, duplicate signing keys and identity mismatch fail closed",async t=>{
 const f=fixture(t);
 for(const x of [async()=>{throw Error("offline")},async()=>Response.json({keys:[jwk,jwk]}),async()=>Response.json({keys:[]})])assert.equal((await invoke(request(),f.env,context,x)).status,403);
 for(const ctx of [{access:{aud,getIdentity:async()=>({email:"other@example.invalid"})}},{access:{aud,getIdentity:async()=>null}},{access:{aud,getIdentity:async()=>{throw Error("identity offline")}}}])assert.equal((await invoke(request(),f.env,ctx)).status,403);
 assert.equal((await invoke(request(),{...f.env,ADMIN_EMAIL:"other@example.invalid"})).status,403);
 assert.equal(f.reads(),0);
});
test("only exact staging hostname and environment accepted; alternative URLs and forged headers cannot bypass",async t=>{
 const f=fixture(t);
 for(const origin of ["https://other.example.invalid","https://preview-desset-merchant-staging.morimil-pabfelon.workers.dev","https://desset.lat","http://desset-merchant-staging.morimil-pabfelon.workers.dev"])assert.equal((await invoke(request("/admin",{origin}),f.env)).status,403);
 assert.equal((await invoke(request(),{...f.env,ENVIRONMENT:"production"})).status,403);
 assert.equal((await invoke(request("/admin",{token:null,headers:{"Cf-Access-Authenticated-User-Email":email,"X-Role":"merchant-reviewer","X-Forwarded-Host":new URL(STAGING_ORIGIN).host}}),f.env,null)).status,403);
 assert.equal(f.reads(),0);
});
test("public intake and scheduled notifications remain hard-disabled even with enabled bindings",async t=>{
 const f=fixture(t);f.db.exec("UPDATE merchant_runtime SET privacy_version='TEST-v1',intake_enabled=1,notification_enabled=1");
 const env={...f.env,INTAKE_ENABLED:"true",NOTIFICATIONS_ENABLED:"true"};
 for(const method of ["GET","POST","PUT","DELETE"])assert.equal((await invoke(request("/api/intake",{method,headers:{Origin:STAGING_ORIGIN}}),env)).status,503);
 assert.equal(typeof worker.scheduled,"undefined");assert.equal(f.reads(),0);
 assert.equal((await invoke(request(),env)).status,503);
 assert.equal(f.db.prepare("SELECT count(*) n FROM merchant_requests").get().n,1);
});
test("private panel and JSON require authorized identity; escaping and no-store",async t=>{
 const f=fixture(t);
 const page=await invoke(request(),f.env);assert.equal(page.status,200);assert.equal(page.headers.get("Cache-Control"),"no-store");
 const html=await page.text();assert.match(html,/&lt;script&gt;bad&lt;\/script&gt;/);assert.doesNotMatch(html,/<script>/);assert.match(html,/name="csrf" value="[a-f0-9]{64}"/);
 const api=await invoke(request("/admin/api/requests"),f.env);assert.equal(api.status,200);assert.equal((await api.json()).requests[0].id,id);
 assert.equal((await invoke(request("/admin?offset=-1"),f.env)).status,400);
 for(const path of ["/","/admin%2fapi%2frequests","/internal/merchant-production/schema.sql","/admin/unknown"])assert.equal((await invoke(request(path),f.env)).status,404);
});
test("review CSRF, origin, token binding, identity and terminal audit",async t=>{
 const f=fixture(t);
 const html=await (await invoke(request(),f.env)).text(),csrf=html.match(/name="csrf" value="([a-f0-9]{64})"/)[1];
 const review=(data,headers={},jwt=token)=>request("/admin/review",{method:"POST",token:jwt,headers:{Origin:STAGING_ORIGIN,"Content-Type":"application/x-www-form-urlencoded",...headers},body:new URLSearchParams(data)});
 const data={id,decision:"APPROVED",csrf};
 assert.equal((await invoke(review({...data,csrf:"wrong"}),f.env)).status,403);
 assert.equal((await invoke(review(data,{Origin:"https://other.invalid"}),f.env)).status,403);
 assert.equal((await invoke(review(data,{"Sec-Fetch-Site":"cross-site"}),f.env)).status,403);
 assert.equal((await invoke(review({...data,actor:"forged"}),f.env)).status,403);
 assert.equal((await invoke(review(data,{},await sign({...payload,iat:now-20})),f.env)).status,403);
 assert.equal(f.db.prepare("SELECT status FROM merchant_requests WHERE id=?").get(id).status,"PENDING");
 assert.equal((await invoke(review(data),f.env)).status,303);
 assert.equal((await invoke(review({...data,decision:"REJECTED"}),f.env)).status,409);
 assert.deepEqual({...f.db.prepare("SELECT actor_id,decision FROM merchant_review_events WHERE request_id=?").get(id)},{actor_id:sub,decision:"APPROVED"});
});
test("wrong D1 environment and disabled policy cannot read request data",async t=>{
 const f=fixture(t);assert.equal((await invoke(request(),{...f.env,ADMIN_POLICY_VERIFIED:"false"})).status,503);assert.equal(f.reads(),0);
 f.db.exec("UPDATE merchant_runtime SET environment='production'");assert.equal((await invoke(request(),f.env)).status,503);assert.equal(f.reads(),1);
});
