// Internal candidate only: no DOM, fetch, credentials, storage or live wiring.
// One immutable normalized submission per attempt; caller must explicitly start a new attempt for changed data.
// Transport is injected by a separately reviewed same-origin adapter. Never publish this module as-is.
import {normalizeContact,uuid} from "./contact-contract.mjs";
const result=(state,extra={})=>Object.freeze({state,...extra});
const newKey=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,"0")).join("");
export function createIntakeAttempt({input,privacyVersion,transport,requestKey=newKey()}={}){
 if(typeof transport!=="function"||typeof privacyVersion!=="string"||!/^[A-Za-z0-9][A-Za-z0-9_.:-]{2,119}$/.test(privacyVersion))throw Error("INTAKE_CONFIGURATION");
 const fields=["category","person","email","organization","phone","subject","message","consent"];
 if(!input||typeof input!=="object"||Array.isArray(input)||Object.keys(input).length!==fields.length||fields.some(k=>!Object.hasOwn(input,k)))throw Error("INTAKE_FIELDS");
 const normalized=normalizeContact({...input,privacyVersion,requestKey,challenge:"validation-placeholder"},privacyVersion);
 const {challenge:unused,...payload}=normalized;
 const immutable=Object.freeze({...payload,consent:true});
 let busy=false,terminal=null;
 async function submit(challenge){
  if(terminal)return terminal;
  if(busy)return result("BUSY");
  if(typeof challenge!=="string"||!challenge||challenge.length>2048)return result("CHALLENGE_REQUIRED");
  busy=true;
  try{
   const response=await transport("/api/contact",{
    method:"POST",headers:{"Content-Type":"application/json"},credentials:"same-origin",
    cache:"no-store",redirect:"error",body:JSON.stringify({...immutable,challenge})
   });
   if(response?.status===200||response?.status===201){
    const value=await response.json();
    if(!value||typeof value!=="object"||Object.keys(value).length!==2||typeof value.id!=="string"||!uuid.test(value.id)||value.replayed!==(response.status===200))return result("RETRY_UNCERTAIN");
    terminal=result("RECEIVED",{id:value.id,replayed:value.replayed});
    return terminal;
   }
   if(response?.status===409){terminal=result("CONFLICT");return terminal;}
   if(response?.status===400||response?.status===413||response?.status===415){terminal=result("INVALID");return terminal;}
   if(response?.status===403)return result("CHALLENGE_OR_ACCESS_DENIED");
   if(response?.status===429)return result("THROTTLED");
   if(response?.status===503)return result("UNAVAILABLE");
   return result("RETRY_UNCERTAIN");
  }catch{return result("RETRY_UNCERTAIN");}
  finally{busy=false;}
 }
 return Object.freeze({submit});
}
