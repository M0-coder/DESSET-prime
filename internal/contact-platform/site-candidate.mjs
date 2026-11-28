// Shared, restricted form asset router; requires an explicit reviewed asset binding.
// No static asset router bypass, no automatic deployment or public package modification.
import {intakePreflight,requireContactScope,stagingScope} from "./gates.mjs";
import {renderManagedContact} from "./form-render.mjs";
const template="/internal/contact-ready/index.html";
const assets=Object.freeze({
 "/styles.css":"text/css; charset=utf-8","/styles-system.css":"text/css; charset=utf-8","/styles-typography.css":"text/css; charset=utf-8","/styles-contact.css":"text/css; charset=utf-8",
 "/scripts/app.js":"text/javascript; charset=utf-8","/assets/deliver-assets-mark.png":"image/png","/fonts/inter-latin-variable.woff2":"font/woff2","/fonts/plus-jakarta-sans-latin-variable.woff2":"font/woff2",
 "/internal/contact-ready/contact-ready.css":"text/css; charset=utf-8","/internal/contact-ready/contact-ready.js":"text/javascript; charset=utf-8",
 "/internal/contact-platform/form-entry.mjs":"text/javascript; charset=utf-8","/internal/contact-platform/form-controller.mjs":"text/javascript; charset=utf-8","/internal/contact-platform/intake-client.mjs":"text/javascript; charset=utf-8","/internal/contact-platform/contact-contract.mjs":"text/javascript; charset=utf-8"
});
const headers={"Cache-Control":"no-store","X-Robots-Tag":"noindex, nofollow","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","Content-Security-Policy":"frame-ancestors 'none'"};
const fail=(status=503)=>new Response("Canal no disponible",{status,headers});
export const isContactSitePath=path=>path==="/"||path===template||Object.hasOwn(assets,path);
export async function serveContactSite(req,env,scope){
 try{
  requireContactScope(scope);
  const url=new URL(req.url);
  if(req.method!=="GET"||url.origin!==scope.origin||env.CONTACT_ORIGIN!==scope.origin||env.ENVIRONMENT!==scope.environment||!isContactSitePath(url.pathname))return fail(404);
  if(env.CONTACT_FORM_ENABLED!=="true"||typeof env.CONTACT_FORM_ASSETS?.fetch!=="function")return fail();
  await intakePreflight(env,scope);
  if(url.pathname==="/")return new Response(null,{status:302,headers:{...headers,Location:template}});
  // Use only constant path names, no caller-provided host, query or arbitrary path.
  const response=await env.CONTACT_FORM_ASSETS.fetch(new Request(scope.origin+url.pathname,{method:"GET",redirect:"error"}));
  if(response.status!==200||response.redirected)return fail();
  if(url.pathname===template){
   const raw=await response.text();if(raw.length>100000)return fail();
   const html=await renderManagedContact(raw,{mode:scope===stagingScope?"staging":"production",privacyVersion:env.CONTACT_PRIVACY_VERSION,privacyNotice:env.CONTACT_PRIVACY_NOTICE,privacySha256:env.CONTACT_PRIVACY_SHA256,siteKey:env.CONTACT_TURNSTILE_SITE_KEY});
   return new Response(html,{headers:{...headers,"Content-Type":"text/html; charset=utf-8"}});
  }
  return new Response(response.body,{headers:{...headers,"Content-Type":assets[url.pathname]}});
 }catch{return fail();}
}
