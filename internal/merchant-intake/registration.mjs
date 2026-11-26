// Loopback-only synthetic implementation; shared renderer also runs in the Worker.
import {readFileSync} from "node:fs";
import {randomBytes} from "node:crypto";
import {createRegistrationShell,createRegistrationRenderer,validateRegistrationForm} from "../merchant-common/registration-view.mjs";
export {privateStyle,privateAdminStyle,validateRegistrationForm} from "../merchant-common/registration-view.mjs";
export {territoryScript} from "../merchant-common/location-ui.mjs";
const root=new URL("../../",import.meta.url);
const allowedAssets=Object.freeze({"styles.css":"text/css","styles-system.css":"text/css","styles-typography.css":"text/css","styles-onboarding.css":"text/css","assets/deliver-assets-mark.png":"image/png","fonts/inter-latin-variable.woff2":"font/woff2","fonts/plus-jakarta-sans-latin-variable.woff2":"font/woff2"});
export function registrationAsset(path){
 const name=path.slice(1);
 if(!Object.hasOwn(allowedAssets,name))return null;
 return {body:readFileSync(new URL(name,root)),type:allowedAssets[name]};
}
const publicTemplate=()=>readFileSync(new URL("registro-comercios.html",root),"utf8");

const {form,confirmation,received}=createRegistrationRenderer({shell:main=>createRegistrationShell(publicTemplate(),"/registro-comercios.html")(main)});
const fail=code=>{throw Error(code);};
export function createRegistration({store,enabled,privacyVersion,clock=Date.now}){
 const drafts=new Map();
 const token=()=>randomBytes(32).toString("hex");
 const purge=()=>{for(const [k,v] of drafts)if(v.expires<=clock())drafts.delete(k);};
 const lookup=b=>{purge();if(Object.keys(b).length!==1||typeof b.draft!=="string"||!drafts.has(b.draft))fail("DRAFT_EXPIRED");return drafts.get(b.draft);};
 const result=(html,status=200)=>({html,status});
 return {
  get(){return enabled?result(form()):result(publicTemplate(),503);},
  post(path,b){
   if(!enabled)return result(publicTemplate(),503);
   purge();
   if(path==="/merchant/confirm"){
    let input;try{input=validateRegistrationForm(b);}catch(e){return result(form({},e.message),400);}
    if(drafts.size>=64)return result(form({},"CAPACITY"),429);
    const key=token();drafts.set(key,{input,key,expires:clock()+900000});
    return result(confirmation(input,key));
   }
   let d;try{d=lookup(b);}catch(e){return result(form({},e.message),400);}
   if(path==="/merchant/edit"){if(d.receipt)return result(received(d.receipt));drafts.delete(b.draft);return result(form({...d.input,email_confirm:d.input.email}));}
   if(path==="/merchant/submit"){
    try{const r=store.submit(d.input,{requestKey:d.key,privacyVersion,consent:true});d.receipt=r.id;return result(received(r.id),r.replayed?200:201);}
    catch(e){return result(confirmation(d.input,b.draft,e.message),["DUPLICATE_BUSINESS","IDEMPOTENCY_CONFLICT"].includes(e.message)?409:503);}
   }
   return result(form({},"INVALID_FIELDS"),400);
  },
  close(){drafts.clear();}
 };
}
