// Candidate only; no deployment configuration or automatically enabled export.
import {candidateHandler} from "./worker.mjs";
import {createPanelCandidate} from "./panel-candidate.mjs";
import {stagingScope,authorizeContact,verifyContactChallenge,limitContact} from "./gates.mjs";
import {isContactSitePath,serveContactSite} from "./site-candidate.mjs";
const response=(status,code)=>Response.json({error:code},{status,headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow","X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; frame-ancestors 'none'"}});
export function createStagingCandidate({fetcher=fetch,limit=limitContact,now=Date.now}={}){
 return async(req,env,ctx)=>{
  try{
   if(env?.ENVIRONMENT!=="staging"||env.CONTACT_ORIGIN!==stagingScope.origin||env.CONTACT_STAGING_ENABLED!=="true"||!env.CONTACT_STAGING_DB||env.CONTACT_DB||!/^synthetic-[A-Za-z0-9_.:-]+$/.test(env.CONTACT_PRIVACY_VERSION??"")||!/^synthetic-[A-Za-z0-9_.:-]+$/.test(env.CONTACT_AUTHORIZATION_REF??""))return response(503,"STAGING_DISABLED");
   const url=new URL(req.url);if(url.origin!==stagingScope.origin)return response(403,"HOST");
   if(!(url.pathname==="/api/contact"&&req.method==="POST")&&!(url.pathname==="/panel"||url.pathname.startsWith("/panel/"))&&!(req.method==="GET"&&isContactSitePath(url.pathname)))return response(404,"NOT_FOUND");
   const scoped={...env,CONTACT_DB:env.CONTACT_STAGING_DB};
   const row=await scoped.CONTACT_DB.prepare("SELECT environment,schema_scope FROM contact_runtime WHERE id=1").first();
   if(row?.environment!=="staging"||row.schema_scope!=="contact-staging-v1")return response(503,"STAGING_DISABLED");
   // Stage is private, including intake: verify actual signed Access identity and runtime identity.
   const actor=await authorizeContact(req,scoped,ctx,fetcher,Math.floor(now()/1000));
   if(req.method==="GET"&&isContactSitePath(url.pathname))return serveContactSite(req,scoped,stagingScope);
   const authorize=async()=>actor;
   if(url.pathname==="/api/contact")return candidateHandler({scope:stagingScope,authorize,limit,now,challenge:(token,e)=>verifyContactChallenge(token,e,fetcher,stagingScope)})(req,scoped,ctx);
   return createPanelCandidate({scope:stagingScope,authorize,now})(req,scoped,ctx);
  }catch(e){return response([400,403,404,409,429,503].includes(e?.status)?e.status:503,"STAGING_UNAVAILABLE");}
 };
}
// A separately approved revision must explicitly wire the candidate; accidental deployment remains closed.
export default {fetch(){return response(503,"STAGING_RELEASE_LOCKED");}};
