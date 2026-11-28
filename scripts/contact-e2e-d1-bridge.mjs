// Browser-lab-only binding of actual intake adapter. No public deployment.
import {createIntakeAttempt} from "/internal/contact-platform/intake-client.mjs";
const field=id=>document.getElementById(id),form=field("demo-form"),result=field("demo-result"),button=form.querySelector("button"),view=field("form-view");
const notice=document.createElement("p");notice.setAttribute("role","status");form.before(notice);
let attempt=null,signature="",epoch=0,busy=false;
window.addEventListener("hashchange",()=>{epoch++;attempt=null;signature="";busy=false;button.disabled=false;notice.textContent="";delete result.dataset.receipt;});
form.addEventListener("submit",async e=>{
 e.preventDefault();e.stopImmediatePropagation();if(busy||view.hidden||!form.reportValidity())return;
 const input={category:location.hash.slice(1).replace(/^consulta-/,""),person:field("person").value,email:field("email").value,organization:field("org").disabled?"":field("org").value,phone:field("phone").disabled?"":field("phone").value,subject:field("subject").value,message:field("message").value,consent:field("consent").checked};
 if(input.person!=="Synthetic Person"||!/^synthetic[0-9]+@example\.invalid$/.test(input.email)||input.subject!=="Synthetic subject"||input.message!=="Synthetic message"||!["","Synthetic Organization"].includes(input.organization)||!["","+51900000000"].includes(input.phone)){notice.textContent="Solo datos ficticios.";return;}
 const next=JSON.stringify(input);
 if(attempt&&next!==signature){notice.textContent="No modifiques una solicitud pendiente.";return;}
 try{if(!attempt){attempt=createIntakeAttempt({input,privacyVersion:"synthetic-v1",transport:(path,options)=>fetch(path,options)});signature=next;}}catch{notice.textContent="Datos de prueba no válidos.";return;}
 const stamp=epoch;busy=true;button.disabled=true;notice.textContent="Procesando prueba…";
 try{
  const receipt=await attempt.submit("synthetic-test");if(stamp!==epoch)return;
  if(receipt.state!=="RECEIVED"){notice.textContent="Solicitud no confirmada: "+receipt.state;return;}
  form.reset();field("count").textContent="0 / 2000 caracteres";form.hidden=true;result.hidden=false;result.dataset.receipt=receipt.id;
  result.querySelector("h2").textContent="Consulta sintética recibida";result.querySelector("p").textContent="Registro temporal de prueba: "+receipt.id;notice.textContent="";result.focus();
 }finally{if(stamp===epoch){busy=false;button.disabled=false;}}
},true);
