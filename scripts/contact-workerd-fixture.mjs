// Synthetic local harness. Never a deployment entrypoint.
import locked,{candidateHandler} from "../internal/contact-platform/worker.mjs";
import {purgeExpired} from "../internal/contact-platform/d1-store.mjs";
import {authorizeContact} from "../internal/contact-platform/gates.mjs";
const now=1700000000000;
export default {async fetch(req,env,ctx){
 if(env.LAB_ONLY!=="synthetic-local-only")return new Response(null,{status:503});
 const path=new URL(req.url).pathname;
 if(path==="/__locked")return locked.fetch(req,env,ctx);
 if(path==="/__purge")return Response.json({deleted:await purgeExpired(env.CONTACT_DB,now+7*86400000)});
 // The test-only identity header emulates provider context. It is never trusted by the production candidate.
 const email=req.headers.get("X-Lab-Identity");
 const runtime=email?{access:{aud:env.CONTACT_ACCESS_AUD,getIdentity:async()=>({email})}}:{};
 const testEnv=req.headers.get("X-Lab-Roster")==="revoked"?{...env,CONTACT_ADMIN_ROSTER:env.LAB_REVOKED_ROSTER}:env;
 const handle=candidateHandler({
 now:()=>now,limit:async()=>true,
 challenge:async token=>{if(token==="kill-switch"){await env.CONTACT_DB.prepare("UPDATE contact_runtime SET intake_enabled=0 WHERE id=1").run();return true;}return token==="synthetic-test";},
 authorize:(request,e,c)=>authorizeContact(request,e,c,async(url,options)=>{
  if(url!==env.CONTACT_ACCESS_ISSUER+"/cdn-cgi/access/certs"||options.redirect!=="error")throw Error("unexpected key endpoint");
  return Response.json(JSON.parse(env.LAB_JWKS));
 },now/1000)
 });
 return handle(req,testEnv,runtime);
}};
