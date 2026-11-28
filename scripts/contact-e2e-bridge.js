// Only served by the ephemeral loopback CI fixture. Never included in dist.
(()=>{
 const form=document.getElementById("demo-form"),result=document.getElementById("demo-result"),button=form.querySelector("button"),view=document.getElementById("form-view");
 const field=id=>document.getElementById(id),hex=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,"0")).join("");
 let epoch=0,key=hex(),busy=false;
 const notice=document.createElement("p");notice.id="integration-status";notice.setAttribute("role","status");form.before(notice);
 function reset(){epoch++;key=hex();busy=false;button.disabled=false;notice.textContent="";delete result.dataset.receipt;}
 window.addEventListener("hashchange",reset);
 form.addEventListener("submit",async e=>{
  e.preventDefault();e.stopImmediatePropagation();if(busy||view.hidden||!form.reportValidity())return;
  const category=location.hash.slice(1).replace(/^consulta-/,"");
  const data={category,person:field("person").value,email:field("email").value,organization:field("org").disabled?"":field("org").value,phone:field("phone").disabled?"":field("phone").value,subject:field("subject").value,message:field("message").value,consent:field("consent").checked,privacyVersion:"synthetic-v1",requestKey:key,challenge:"synthetic-test"};
  // Restrict browser fixture to exact generated strings; no real data may be submitted.
  if(data.person!=="Synthetic Person"||!/^synthetic[0-9]+@example\.invalid$/.test(data.email)||data.subject!=="Synthetic subject"||data.message!=="Synthetic message"||!["","Synthetic Organization"].includes(data.organization)||!["","+51900000000"].includes(data.phone)){notice.textContent="Solo se permiten los datos sintéticos de esta prueba.";return;}
  const stamp=epoch;busy=true;button.disabled=true;notice.textContent="Procesando prueba…";
  try{
   const res=await fetch("/api/contact",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(data),credentials:"same-origin",cache:"no-store",redirect:"error"});
   const v=await res.json();
   if(!res.ok||!(/^[a-f0-9-]{36}$/).test(v.id??""))throw Error("Rejected");
   if(stamp!==epoch)return;
   form.reset();field("count").textContent="0 / 2000 caracteres";form.hidden=true;result.hidden=false;result.dataset.receipt=v.id;
   result.querySelector("h2").textContent="Consulta sintética recibida";
   result.querySelector("p").textContent="Registro temporal de prueba: "+v.id;
   notice.textContent="";result.focus();
  }catch{if(stamp===epoch)notice.textContent="No se pudo completar la prueba. Intenta nuevamente.";}
  finally{if(stamp===epoch){busy=false;button.disabled=false;}}
 },true);
})();
