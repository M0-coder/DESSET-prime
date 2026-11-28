// Reusable managed form controller. No automatic transmission, browser storage or synthetic success.
import {createIntakeAttempt} from "./intake-client.mjs";
const state=s=>Object.freeze({state:s});
function bounded(task,ms){
 const abort=new AbortController();let timer;
 return Promise.race([Promise.resolve().then(()=>task(abort.signal)),new Promise((_,reject)=>{timer=setTimeout(()=>{abort.abort();reject(Error("TIMEOUT"));},ms);})]).finally(()=>clearTimeout(timer));
}
export function createFormController({privacyVersion,getChallenge,fetcher=fetch,timeoutMs=15000}={}){
 if(typeof getChallenge!=="function"||typeof fetcher!=="function"||!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>60000||typeof privacyVersion!=="string"||!/^[A-Za-z0-9][A-Za-z0-9_.:-]{2,119}$/.test(privacyVersion))throw Error("FORM_CONFIGURATION");
 let attempt=null,signature="",busy=false,lastToken=null,last=null;
 const pending=()=>busy||Boolean(attempt&&!["RECEIVED","INVALID","CONFLICT"].includes(last?.state));
 const reset=()=>{if(pending())return false;attempt=null;signature="";last=null;return true;};
 async function submit(input){
  if(busy)return state("BUSY");
  if(input?.consent!==true)return state("CONSENT_REQUIRED");
  const next=JSON.stringify(input);
  if(attempt&&next!==signature)return state("ATTEMPT_PENDING");
  if(last&&["RECEIVED","INVALID","CONFLICT"].includes(last.state))return last;
  if(!attempt){
   try{attempt=createIntakeAttempt({input,privacyVersion,transport:(path,options)=>bounded(async signal=>{
    if(path!=="/api/contact")throw Error("ROUTE");
    const response=await fetcher(path,{...options,signal});
    if(response.status===200||response.status===201){
     if(!/^application\/json(?:\s*;|$)/i.test(response.headers.get("Content-Type")??""))throw Error("RECEIPT_TYPE");
     const value=await response.json();return {status:response.status,json:async()=>value};
    }
    return response;
   },timeoutMs)});signature=next;}catch{return state("INVALID");}
  }
  busy=true;
  try{
   let token;try{token=await bounded(signal=>getChallenge(signal),timeoutMs);}catch{return last=state("CHALLENGE_REQUIRED");}
   if(typeof token!=="string"||!token||token.length>2048||token===lastToken)return last=state("CHALLENGE_REQUIRED");
   lastToken=token;return last=await attempt.submit(token);
  }finally{busy=false;}
 }
 return Object.freeze({submit,reset,pending});
}
export function mountContactForm({doc=document,win=window,privacyVersion,getChallenge,fetcher=fetch,timeoutMs=15000,acceptInput=()=>true,receiptTitle="Consulta recibida"}={}){
 const field=id=>doc.getElementById(id),form=field("demo-form"),result=field("demo-result"),button=form?.querySelector("button[type=submit]"),view=field("form-view");
 if(!form||!button||!result||!view||form.dataset.contactMode!=="managed")throw Error("FORM_MARKUP");
 const controller=createFormController({privacyVersion,getChallenge,fetcher,timeoutMs});
 const notice=doc.createElement("p");notice.setAttribute("role","status");form.before(notice);
 let busy=false,epoch=0;
 const messages={CONSENT_REQUIRED:"Debes aceptar el aviso de privacidad.",ATTEMPT_PENDING:"Hay una solicitud pendiente. Recupera los datos originales antes de reintentar.",CHALLENGE_REQUIRED:"No se completó la verificación. Intenta nuevamente.",CHALLENGE_OR_ACCESS_DENIED:"Verificación rechazada. Intenta nuevamente.",THROTTLED:"Demasiadas solicitudes. Intenta más tarde.",UNAVAILABLE:"Servicio no disponible. Intenta más tarde con los mismos datos.",RETRY_UNCERTAIN:"No se pudo confirmar el envío. Reintenta con los mismos datos para evitar duplicados.",CONFLICT:"La solicitud no pudo confirmarse. No repitas el envío sin revisar el caso.",INVALID:"Revisa los datos antes de iniciar otra solicitud."};
 win.addEventListener("beforeunload",e=>{if(controller.pending()){e.preventDefault();e.returnValue="";}});
 win.addEventListener("hashchange",()=>{epoch++;delete result.dataset.receipt;if(controller.reset())notice.textContent="";else notice.textContent="Hay una solicitud pendiente; vuelve a la categoría y conserva los datos originales.";button.disabled=busy;});
 form.addEventListener("submit",async e=>{
  e.preventDefault();e.stopImmediatePropagation();if(busy||view.hidden||!form.reportValidity())return;
  const input={category:win.location.hash.slice(1).replace(/^consulta-/,""),person:field("person").value,email:field("email").value,organization:field("org").disabled?"":field("org").value,phone:field("phone").disabled?"":field("phone").value,subject:field("subject").value,message:field("message").value,consent:field("consent").checked};
  if(!acceptInput(input)){notice.textContent="Datos no permitidos en este entorno.";return;}
  const stamp=epoch;busy=true;button.disabled=true;notice.textContent="Procesando solicitud…";
  try{
   const receipt=await controller.submit(input);
   if(stamp!==epoch){notice.textContent=receipt.state==="RECEIVED"?"Consulta recibida. Referencia: "+receipt.id:"Solicitud no confirmada. Recupera los datos originales.";return;}
   if(receipt.state!=="RECEIVED"){notice.textContent=messages[receipt.state]??"Solicitud no confirmada.";if(receipt.state==="INVALID")controller.reset();return;}
   form.reset();field("count").textContent="0 / 2000 caracteres";form.hidden=true;result.hidden=false;result.dataset.receipt=receipt.id;
   result.querySelector("h2").textContent=receiptTitle;result.querySelector("p").textContent="Referencia: "+receipt.id;notice.textContent="";result.focus();
  }finally{busy=false;button.disabled=false;}
 },true);
 button.disabled=false;
 return controller;
}
