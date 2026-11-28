// Named composition candidate; accidental deployment remains hard locked.
import {candidateHandler} from "./worker.mjs";
import {createPanelCandidate} from "./panel-candidate.mjs";
import {productionScope} from "./gates.mjs";
import {isContactSitePath,serveContactSite} from "./site-candidate.mjs";
const closed=(status=503)=>new Response("Canal no disponible",{status,headers:{"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow","X-Content-Type-Options":"nosniff"}});
export function createProductionContactCandidate(){
 const api=candidateHandler(),panel=createPanelCandidate();
 return async(req,env,ctx)=>{
  if(env?.CONTACT_SITE_ENABLED!=="true"||env.ENVIRONMENT!=="production"||env.CONTACT_ORIGIN!==productionScope.origin||env.CONTACT_STAGING_DB)return closed();
  const url=new URL(req.url);if(url.origin!==productionScope.origin)return closed(403);
  if(req.method==="GET"&&isContactSitePath(url.pathname))return serveContactSite(req,env,productionScope);
  if(req.method==="POST"&&url.pathname==="/api/contact")return api(req,env,ctx);
  if(url.pathname==="/panel"||url.pathname.startsWith("/panel/"))return panel(req,env,ctx);
  return closed(404);
 };
}
export default {fetch(){return closed();}};
