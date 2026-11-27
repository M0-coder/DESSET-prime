// Synthetic local harness. Never a deployment entrypoint.
import locked,{candidateHandler} from "../internal/contact-platform/worker.mjs";
import {purgeExpired} from "../internal/contact-platform/d1-store.mjs";
const now=1700000000000, csrf="c".repeat(64);
export default {async fetch(req,env,ctx){
 if(env.LAB_ONLY!=="synthetic-local-only")return new Response(null,{status:503});
 const path=new URL(req.url).pathname;
 if(path==="/__locked")return locked.fetch(req,env,ctx);
 if(path==="/__purge")return Response.json({deleted:await purgeExpired(env.CONTACT_DB,now+7*86400000)});
 const handle=candidateHandler({
 now:()=>now,limit:async()=>true,
 challenge:async token=>{if(token==="kill-switch"){await env.CONTACT_DB.prepare("UPDATE contact_runtime SET intake_enabled=0 WHERE id=1").run();return true;}return token==="synthetic-test";},
 authorize:async request=>{if(request.headers.get("Authorization")!=="Synthetic admin")throw Object.assign(Error("ACCESS_DENIED"),{status:403,code:"ACCESS_DENIED"});return {actor:"synthetic-admin",categories:["marketing"],csrf};}
 });
 return handle(req,env,ctx);
}};
