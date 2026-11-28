// Local instrumented D1 adapter for the existing browser regression harness.
import {createRequire} from "node:module";
import {resolve} from "node:path";
import {readFileSync} from "node:fs";
import {createHash,generateKeyPairSync,sign} from "node:crypto";
import {categories} from "../internal/contact-platform/d1-store.mjs";
const origin="https://contacto.desset.lat",now=1700000000000;
export async function createD1BrowserBackend({admin,restricted}){
 if(process.env.CI!=="true"||process.env.DESSET_CONTACT_SYNTHETIC_E2E!=="1"||!process.env.CONTACT_LAB_PREFIX)throw Error("D1 browser fixture disabled");
 const {Miniflare}=createRequire(resolve(process.env.CONTACT_LAB_PREFIX,"package.json"))("miniflare");
 const issuer="https://synthetic.cloudflareaccess.com",aud="a".repeat(64),notice="Synthetic test notice, not an approved privacy policy. ".repeat(8),hash=createHash("sha256").update(notice).digest("hex");
 const roster=[{subject:"synthetic-all",email:"all@example.invalid",categories:[...categories]},{subject:"synthetic-restricted",email:"restricted@example.invalid",categories:["marketing"]}];
 const {publicKey,privateKey}=generateKeyPairSync("rsa",{modulusLength:2048});
 const enc=v=>Buffer.from(JSON.stringify(v)).toString("base64url");
 const tokens=roster.map(a=>{const u=enc({alg:"RS256",kid:"lab-key"})+"."+enc({iss:issuer,aud:[aud],iat:now/1000-10,exp:now/1000+100,sub:a.subject,email:a.email,type:"app"});return u+"."+sign("RSA-SHA256",Buffer.from(u),privateKey).toString("base64url");});
 const bindings={LAB_ONLY:"synthetic-local-only",ENVIRONMENT:"production",CONTACT_ORIGIN:origin,CONTACT_INTAKE_ENABLED:"true",CONTACT_POLICY_VERIFIED:"true",CONTACT_AUTHORIZATION_REF:"synthetic-approval",CONTACT_PRIVACY_VERSION:"synthetic-v1",CONTACT_PRIVACY_SHA256:hash,CONTACT_PRIVACY_NOTICE:notice,CONTACT_LIMIT:{},CONTACT_TURNSTILE_SECRET:"synthetic",CONTACT_RETENTION_DAYS:"7",CONTACT_CAPACITY:"500",CONTACT_ADMIN_ENABLED:"true",CONTACT_ADMIN_POLICY_VERIFIED:"true",CONTACT_ACCESS_ISSUER:issuer,CONTACT_ACCESS_AUD:aud,CONTACT_ADMIN_ROSTER:JSON.stringify(roster),LAB_REVOKED_ROSTER:"[]",LAB_JWKS:JSON.stringify({keys:[{...publicKey.export({format:"jwk"}),kid:"lab-key",alg:"RS256",use:"sig"}]})};
 const mf=new Miniflare({host:"127.0.0.1",port:0,cf:false,modules:true,modulesRoot:process.cwd(),scriptPath:"scripts/contact-workerd-fixture.mjs",compatibilityDate:"2025-11-01",d1Databases:{CONTACT_DB:"synthetic-browser-contact"},d1Persist:false,bindings,outboundService:()=>new Response("External network denied",{status:503})});
 try{
 const db=await mf.getD1Database("CONTACT_DB");
 for(const file of ["runtime.sql","d1-schema.sql","maintenance-schema.sql"]){
  let buf="";const parts=[];
  for(const line of readFileSync(resolve("internal/contact-platform",file),"utf8").split("\n")){if(!line.trim()||line.trimStart().startsWith("--"))continue;buf+=line+"\n";if(/^CREATE TRIGGER/i.test(buf.trim())?/END;\s*$/i.test(line):/;\s*$/.test(line)){parts.push(buf.trim());buf="";}}
  if(buf.trim())throw Error("Incomplete migration");const result=await db.batch(parts.map(x=>db.prepare(x)));if(!result.every(x=>x.success))throw Error("Migration failed");
 }
 await db.prepare("UPDATE contact_runtime SET environment='production',intake_enabled=1,privacy_version=?,privacy_sha256=?,authorization_ref=? WHERE id=1").bind(bindings.CONTACT_PRIVACY_VERSION,hash,bindings.CONTACT_AUTHORIZATION_REF).run();
 let challenge=true;
 const handle=async req=>{
  const url=new URL(req.url),h=new Headers();
  for(const key of ["content-type","origin","sec-fetch-site"])if(req.headers.has(key))h.set(key,req.headers.get(key));
  if(url.pathname==="/api/contact"){
   if(!challenge)return Response.json({error:"CHALLENGE_INVALID"},{status:403});
   let v;try{v=await req.clone().json();}catch{return new Response(null,{status:400});}
   if(v.person!=="Synthetic Person"||!/^synthetic[0-9]+@example\.invalid$/.test(v.email??"")||v.subject!=="Synthetic subject"||v.message!=="Synthetic message"||!["","Synthetic Organization"].includes(v.organization)||!["","+51900000000"].includes(v.phone)||v.challenge!=="synthetic-test")return new Response(null,{status:400});
  }else{
   const token=req.headers.get("X-Fixture-Admin"),i=token===admin?0:token===restricted?1:-1;
   h.set("X-Lab-Panel","enabled");
   if(i>=0){h.set("Cf-Access-Jwt-Assertion",tokens[i]);h.set("X-Lab-Identity",roster[i].email);}
  }
  return mf.dispatchFetch(origin+url.pathname+url.search,{method:req.method,headers:h,...(req.method==="POST"?{body:await req.arrayBuffer()}:{}),redirect:"manual"});
 };
 return {handle,challenge:v=>{challenge=v;},db:{prepare:sql=>({get:async(...args)=>{const q=db.prepare(sql);return (args.length?q.bind(...args):q).first();}})},purge:async()=>{const p=await mf.dispatchFetch(origin+"/__purge",{redirect:"manual"});if(p.status!==200)throw Error("Purge failed");return (await p.json()).deleted;},close:()=>mf.dispose()};
 }catch(e){await mf.dispose();throw e;}
}
