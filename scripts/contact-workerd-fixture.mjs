// Synthetic local harness. Never a deployment entrypoint.
import locked,{candidateHandler} from "../internal/contact-platform/worker.mjs";
import {purgeExpired} from "../internal/contact-platform/d1-store.mjs";
import {authorizeContact} from "../internal/contact-platform/gates.mjs";
import {operationalSnapshot} from "../internal/contact-platform/operations.mjs";
import {maintenanceCycle} from "../internal/contact-platform/maintenance.mjs";
import {coordinatedMaintenance} from "../internal/contact-platform/coordinated-maintenance.mjs";
const now=1700000000000;
export default {async fetch(req,env,ctx){
 if(env.LAB_ONLY!=="synthetic-local-only")return new Response(null,{status:503});
 const path=new URL(req.url).pathname;
 if(path==="/__locked")return locked.fetch(req,env,ctx);
 if(path==="/__operations"){
  try{return Response.json(await operationalSnapshot({...env,CONTACT_OPERATIONS_ENABLED:req.headers.get("X-Lab-Operations")==="enabled"?"true":"false"},req.headers.get("X-Lab-Clock")==="expiry"?now+7*86400000:now));}
  catch{return Response.json({error:"OPERATIONS_UNAVAILABLE"},{status:503});}
 }
 if(path==="/__coordinated"){
  const kind=req.headers.get("X-Lab-Maintenance");
  const at=now+7*86400000+(req.headers.get("X-Lab-Clock")==="next"?300000:0);
  try{return Response.json(await coordinatedMaintenance({...env,CONTACT_OPERATIONS_ENABLED:"true",CONTACT_MAINTENANCE_ENABLED:"true",CONTACT_MAINTENANCE_APPROVAL_REF:"synthetic-maintenance",CONTACT_PURGE_ENABLED:kind==="approved"||kind==="changed-policy"?"true":"false",CONTACT_RETENTION_APPROVED:"true"},at,{approvalRef:"synthetic-maintenance",capacityPercent:kind==="changed-policy"?21:20,oldestAgeMs:1,maxBatches:1}));}
  catch{return Response.json({error:"COORDINATED_MAINTENANCE_UNAVAILABLE"},{status:503});}
 }
 if(path==="/__maintenance"){
  const kind=req.headers.get("X-Lab-Maintenance"),mode=req.headers.get("X-Lab-Mode")??"preview";
  const policy={approvalRef:kind==="bad-ref"?"different":"synthetic-maintenance",capacityPercent:20,oldestAgeMs:1,maxBatches:kind==="bad-bound"?4:1};
  try{return Response.json(await maintenanceCycle({...env,CONTACT_OPERATIONS_ENABLED:"true",CONTACT_MAINTENANCE_ENABLED:kind==="disabled"?"false":"true",CONTACT_MAINTENANCE_APPROVAL_REF:"synthetic-maintenance",CONTACT_PURGE_ENABLED:kind==="approved"?"true":"false",CONTACT_RETENTION_APPROVED:kind==="approved"?"true":"false"},now+7*86400000,policy,mode));}
  catch{return Response.json({error:"MAINTENANCE_UNAVAILABLE"},{status:503});}
 }
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
