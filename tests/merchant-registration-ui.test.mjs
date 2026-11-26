import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync,rmSync,readFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {randomBytes} from "node:crypto";
import {openMerchantIntake} from "../internal/merchant-intake/intake.mjs";
import {makeReviewerCredential,startSyntheticIntake} from "../internal/merchant-intake/server.mjs";
import {createRegistration,validateRegistrationForm} from "../internal/merchant-intake/registration.mjs";
const actor={id:"reviewer",role:"merchant-reviewer"};
const input={business_name:"Synthetic <shop>",category:"restaurant",department:"Lima",province:"Huaura",district:"Huacho",address:"Test address",postal_code:"15136",interest_level:"evaluating",contact_pronunciation:"Synthetic pronunciation",contact_name:"Synthetic person",phone:"+51900000000",email:"test@example.invalid",email_confirm:"TEST@example.invalid",observations:"<script>literal</script> $&",consent:"yes"};
const read=p=>readFileSync(new URL("../"+p,import.meta.url));
async function fixture(t,enabled){
 const dir=mkdtempSync(join(tmpdir(),"desset-registration-")),databasePath=join(dir,"intake.sqlite"),credential=await makeReviewerCredential(randomBytes(24).toString("hex"));
 const server=await startSyntheticIntake({databasePath,credential,syntheticEnabled:enabled});
 const store=openMerchantIntake(databasePath);
 t.after(async()=>{try{store.close();await server.close();}finally{rmSync(dir,{recursive:true,force:true});}});
 const get=path=>fetch(server.origin+path);
 const post=(path,b,origin=server.origin)=>fetch(server.origin+path,{method:"POST",headers:{Origin:origin,"Content-Type":"application/x-www-form-urlencoded"},body:new URLSearchParams(b)});
 return {get,post,store};
}
const draft=html=>{const m=html.match(/name="draft" value="([a-f0-9]{64})"/);assert.ok(m,"missing draft");return m[1];};
test("Public registration stays closed; private default also closes all writes",async t=>{
 const f=await fixture(t,false),r=await f.get("/registro-comercios.html");assert.equal(r.status,503);
 const html=await r.text();assert.equal(html,read("registro-comercios.html").toString());
 assert.match(html,/form-action 'none'/);assert.doesNotMatch(html,/<form\b/);
 for(const path of ["/merchant/confirm","/merchant/edit","/merchant/submit"])assert.equal((await f.post(path,input)).status,503);
 assert.equal(f.store.list(actor).length,0);
});
test("Private form reuses exact public assets, confirms, edits, submits and replays without a duplicate",async t=>{
 const f=await fixture(t,true),r=await f.get("/registro-comercios.html");assert.equal(r.status,200);
 assert.match(r.headers.get("content-security-policy"),/form-action 'self'/);
 assert.equal(r.headers.get("cache-control"),"no-store");
 assert.equal(r.headers.get("referrer-policy"),"same-origin");
 const html=await r.text();assert.match(html,/<h1>Registra tu comercio\.<\/h1>/);
 assert.match(html,/name="email_confirm" required/);assert.match(html,/name="postal_code" required/);assert.match(html,/name="interest_level" required/);assert.match(html,/name="contact_pronunciation"/);assert.match(html,/action="\/merchant\/confirm"/);
 assert.doesNotMatch(html,/<fieldset disabled|<script\b/);
 for(const path of ["styles.css","styles-system.css","styles-typography.css","styles-onboarding.css","assets/deliver-assets-mark.png","fonts/inter-latin-variable.woff2","fonts/plus-jakarta-sans-latin-variable.woff2"]){
  const a=await f.get("/"+path);assert.equal(a.status,200);assert.deepEqual(Buffer.from(await a.arrayBuffer()),read(path));
 }
 assert.equal((await f.get("/internal/merchant-intake/schema.sql")).status,404);
 assert.equal((await f.post("/merchant/confirm",input,"https://untrusted.invalid")).status,403);
 assert.equal((await f.post("/merchant/confirm",input,"null")).status,403);
 for(const change of [{email_confirm:"other@example.invalid"},{consent:"no"},{email:"real@example.com",email_confirm:"real@example.com"},{category:"unknown"},{district:"unknown"},{extra:"unexpected"},{postal_code:"1234"},{postal_code:"123456"},{postal_code:""},{interest_level:"unknown"},{interest_level:""}])assert.equal((await f.post("/merchant/confirm",{...input,...change})).status,400);
 assert.equal(f.store.list(actor).length,0);
 const c=await f.post("/merchant/confirm",input);assert.equal(c.status,200);const preview=await c.text(),d=draft(preview);
 assert.doesNotMatch(preview,/\b(?:href|src)="\.\//);
 assert.match(preview,/href="\/styles\.css\?v=/);
 assert.match(preview,/src="\/assets\/deliver-assets-mark\.png"/);
 assert.match(preview,/Revisa tu información/);assert.match(preview,/Synthetic &lt;shop&gt;/);
 assert.match(preview,/&lt;script&gt;literal&lt;\/script&gt; \$&amp;/);assert.doesNotMatch(preview,/<script>/);
 assert.equal(f.store.list(actor).length,0);
 const e=await f.post("/merchant/edit",{draft:d});assert.equal(e.status,200);assert.match(await e.text(),/value="Synthetic &lt;shop&gt;"/);
 assert.equal((await f.post("/merchant/submit",{draft:d})).status,400);
 const c2=await f.post("/merchant/confirm",{...input,business_name:"Synthetic revised"}),d2=draft(await c2.text());
 const a=await f.post("/merchant/submit",{draft:d2});assert.equal(a.status,201);const receipt=await a.text();
 assert.match(receipt,/Solicitud de ensayo recibida/);assert.match(receipt,/No constituye una aceptación/);
 const rows=f.store.list(actor);assert.equal(rows.length,1);assert.equal(rows[0].business_name,"Synthetic revised");assert.equal(rows[0].postal_code,"15136");assert.equal(rows[0].interest_level,"evaluating");assert.equal(rows[0].contact_pronunciation,"Synthetic pronunciation");
 assert.equal(rows[0].status,"PENDING");assert.equal(f.store.notificationState(actor,rows[0].id).status,"PENDING");
 const b=await f.post("/merchant/submit",{draft:d2});assert.equal(b.status,200);assert.match(await b.text(),new RegExp(rows[0].id));assert.equal(f.store.list(actor).length,1);
 const dup=draft(await (await f.post("/merchant/confirm",{...input,business_name:"Synthetic revised"})).text());
 assert.equal((await f.post("/merchant/submit",{draft:dup})).status,409);assert.equal(f.store.list(actor).length,1);
 assert.equal((await f.post("/merchant/submit",{draft:d2,consent:"yes"})).status,400);
});
test("Validation does not persist the confirmation email and draft expires before writing",()=>{
 const data=validateRegistrationForm(input);assert.equal(data.email,"test@example.invalid");assert.equal(data.postal_code,"15136");assert.equal(data.interest_level,"evaluating");assert.equal(data.email_confirm,undefined);assert.equal(data.consent,undefined);
 let time=0,writes=0;
 const flow=createRegistration({store:{submit(){writes++;throw Error("unexpected write");}},enabled:true,privacyVersion:"TEST-v1",clock:()=>time});
 const d=draft(flow.post("/merchant/confirm",input).html);time=900001;
 assert.equal(flow.post("/merchant/submit",{draft:d}).status,400);assert.equal(writes,0);flow.close();
});
