// Managed candidate entry, only included by the separately approved renderer.
import {mountContactForm} from "./form-controller.mjs";
const form=document.getElementById("demo-form"),container=document.getElementById("contact-challenge");
if(form?.dataset.contactMode==="managed"&&container){
 const load=new Promise((resolve,reject)=>{
  const script=document.createElement("script");script.src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";script.async=true;script.onload=resolve;script.onerror=reject;document.head.append(script);
 });
 let widget=null;
 const getChallenge=async signal=>{
  await load;if(signal.aborted||!window.turnstile)throw Error("CHALLENGE_UNAVAILABLE");
  if(widget!==null){window.turnstile.remove(widget);widget=null;}
  return new Promise((resolve,reject)=>{
   const finish=(fn,v)=>{signal.removeEventListener("abort",abort);fn(v);};
   const abort=()=>{if(widget!==null){window.turnstile.remove(widget);widget=null;}finish(reject,Error("CHALLENGE_TIMEOUT"));};
   signal.addEventListener("abort",abort,{once:true});
   try{widget=window.turnstile.render(container,{sitekey:form.dataset.siteKey,action:"contact_intake",execution:"execute",callback:token=>finish(resolve,token),"error-callback":()=>finish(reject,Error("CHALLENGE_ERROR")),"expired-callback":()=>finish(reject,Error("CHALLENGE_EXPIRED"))});window.turnstile.execute(widget);}catch(e){finish(reject,e);}
  });
 };
 load.catch(()=>{});
 mountContactForm({privacyVersion:form.dataset.privacyVersion,getChallenge});
}
