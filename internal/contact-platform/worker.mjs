// Worker candidate. The actual default export is hard-locked until a separately approved code revision.
// No deployment command, no production credentials, no public form or scheduled purge.
import {intakePreflight,verifyContactChallenge,limitContact,authorizeContact,proposedOrigin} from "./gates.mjs";
import {normalizeContact,receive,queue,detail,transition} from "./d1-store.mjs";
const fail=(status,code)=>Object.assign(Error(code),{status,code});
const response=(value,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","X-Robots-Tag":"noindex, nofollow","Referrer-Policy":"no-referrer","Content-Security-Policy":"default-src 'none'; frame-ancestors 'none'; base-uri 'none'"}});
async function body(req){
 if((req.headers.get("content-type")??"").split(";")[0].trim()!=="application/json"||!req.body)throw fail(415,"CONTENT_TYPE");
 const reader=req.body.getReader(),dec=new TextDecoder("utf-8",{fatal:true});let n=0,s="";
 try{while(true){const x=await reader.read();if(x.done)break;n+=x.value.byteLength;if(n>12000){await reader.cancel();throw fail(413,"BODY_LIMIT");}s+=dec.decode(x.value,{stream:true});}s+=dec.decode();return JSON.parse(s);}catch(e){if(e.status)throw e;throw fail(400,"INVALID_JSON");}finally{reader.releaseLock();}
}
export function candidateHandler({preflight=intakePreflight,challenge=verifyContactChallenge,limit=limitContact,authorize=authorizeContact,now=Date.now}={}){
 return async(req,env,ctx)=>{
  try{
   const url=new URL(req.url),at=now();
   if(url.origin!==proposedOrigin||env.CONTACT_ORIGIN!==proposedOrigin)throw fail(403,"HOST");
   if(req.method==="POST"&&(req.headers.get("Origin")!==proposedOrigin||req.headers.get("Sec-Fetch-Site")==="cross-site"))throw fail(403,"ORIGIN");
   if(req.method==="POST"&&url.pathname==="/api/contact"){
    const gate=await preflight(env);
    if(await limit(req,env)!==true)throw fail(429,"RATE_LIMIT");
    const data=normalizeContact(await body(req),gate.privacyVersion);
    if(await challenge(data.challenge,env)!==true)throw fail(403,"CHALLENGE_INVALID");
    if(!/^[1-9][0-9]{0,2}$/.test(env.CONTACT_RETENTION_DAYS??"")||!/^[1-9][0-9]{0,4}$/.test(env.CONTACT_CAPACITY??""))throw fail(503,"POLICY_REQUIRED");
    const receipt=await receive(env.CONTACT_DB,data,{...gate,privacySha256:env.CONTACT_PRIVACY_SHA256,retentionDays:Number(env.CONTACT_RETENTION_DAYS),capacity:Number(env.CONTACT_CAPACITY)},at);
    return response(receipt,receipt.replayed?200:201);
   }
   if(url.pathname.startsWith("/admin/")){
    if(env.ENVIRONMENT!=="production"||env.CONTACT_ADMIN_ENABLED!=="true"||!env.CONTACT_DB)throw fail(503,"ADMIN_DISABLED");
    const actor=await authorize(req,env,ctx);
    if(req.method==="GET"&&url.pathname==="/admin/queue")return response({items:await queue(env.CONTACT_DB,actor,url.searchParams.get("category"),at)});
    if(req.method==="GET"&&url.pathname.startsWith("/admin/request/"))return response(await detail(env.CONTACT_DB,actor,url.pathname.slice("/admin/request/".length),at));
    if(req.method==="POST"&&url.pathname==="/admin/transition"){
     if(typeof actor.csrf!=="string"||!/^[a-f0-9]{64}$/.test(actor.csrf)||req.headers.get("X-CSRF-Token")!==actor.csrf)throw fail(403,"CSRF");
     return response(await transition(env.CONTACT_DB,actor,await body(req),at));
    }
   }
   throw fail(404,"NOT_FOUND");
  }catch(e){const status=Number.isInteger(e.status)&&e.status>=400&&e.status<=599?e.status:503;return response({error:typeof e.code==="string"&&/^[A-Z_]+$/.test(e.code)?e.code:"UNAVAILABLE"},status);}
 };
}
// This export cannot collect, read or delete any records, regardless of environment variables.
export default {fetch(){return response({error:"CONTACT_RELEASE_LOCKED"},503);}};
