// Private loopback-only registration UI. Reuse the approved public visual shell and CSS.
import {readFileSync} from "node:fs";
import {randomBytes} from "node:crypto";
import {validateMerchantInput,interestLevels} from "./intake.mjs";
const root=new URL("../../",import.meta.url);
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const categories={restaurant:"Restaurantes y gastronomía",grocery:"Supermercados y bodegas",bakery:"Panaderías y pastelerías",specialty:"Tiendas especializadas",pharmacy:"Farmacias",other:"Otros comercios"};
const interestLabels={ready:"Deseo incorporarme cuando se habilite",soon:"Planeo incorporarme próximamente",evaluating:"Estoy evaluando la incorporación",information:"Deseo recibir información"};
const fields=[
 ["business_name","nombre-comercial","Nombre comercial"],["category","categoria","Tipo de comercio"],
 ["department","departamento","Departamento"],["province","provincia","Provincia"],["district","distrito","Distrito"],["postal_code","codigo-postal","Código postal"],["address","direccion","Dirección del establecimiento"],
 ["contact_name","responsable","Nombres y apellidos"],["contact_pronunciation","pronunciacion","Pronunciación del nombre (opcional)"],["phone","telefono","Teléfono"],["email","correo","Correo electrónico"],["email_confirm","confirmar-correo","Confirmar correo electrónico"],["interest_level","interes","Estado de interés en la incorporación"]
];
const keys=fields.map(f=>f[0]);
const allowedAssets=Object.freeze({"styles.css":"text/css","styles-system.css":"text/css","styles-typography.css":"text/css","styles-onboarding.css":"text/css","assets/deliver-assets-mark.png":"image/png","fonts/inter-latin-variable.woff2":"font/woff2","fonts/plus-jakarta-sans-latin-variable.woff2":"font/woff2"});
export function registrationAsset(path){
 const name=path.slice(1);
 if(!Object.hasOwn(allowedAssets,name))return null;
 return {body:readFileSync(new URL(name,root)),type:allowedAssets[name]};
}
const publicTemplate=()=>readFileSync(new URL("registro-comercios.html",root),"utf8");
const localPath="/registro-comercios.html";
function shell(main){
 const template=publicTemplate();
 if(!/<main class="onboarding-page" id="contenido">[\s\S]*?<\/main>/.test(template))throw Error("REGISTRATION_TEMPLATE_CHANGED");
 return template.replace(/<main class="onboarding-page" id="contenido">[\s\S]*?<\/main>/,()=>main)
 .replace("form-action 'none'","form-action 'self'")
 .replace(/href="\.\/(?:index|comercios|incorporacion-comercios)\.html"/g,'href="'+localPath+'"')
 .replace(/\b(href|src)="\.\/(?!\.\/)/g,'$1="/')
 .replace("</head>",'<link rel="stylesheet" href="/merchant-registration.css"></head>');
}
export const privateStyle=".onboarding-page .ob-submit:not(:disabled){background:#073BBC;color:#fff;cursor:pointer}.onboarding-page .ob-submit:focus-visible{outline:3px solid #000;outline-offset:3px}.onboarding-page .ob-error{border-left:4px solid #B42419;padding:12px;color:#B42419}.onboarding-page .ob-review dt{font-weight:750}.onboarding-page .ob-review dd{margin:4px 0 16px;overflow-wrap:anywhere}";
function stage(n,body){
 const progress=["Información","Confirmación","Recepción"].map((v,i)=>"<li"+(i+1===n?' aria-current="step"':"")+"><strong>0"+(i+1)+"</strong> "+v+"</li>").join("");
 return shell('<main class="onboarding-page" id="contenido"><section class="ob-hero"><p class="ob-kicker">DESSET / COMERCIOS</p><h1>Registra tu comercio.</h1><p>El primer paso para formar parte de DESSET.</p></section><section class="ob-inner" aria-label="Ensayo privado de incorporación"><p class="ob-notice">Entorno privado de ensayo. Usa únicamente datos sintéticos: nombre comercial que comience por Synthetic, teléfono +51900000000 y correo terminado en .invalid. No se aceptan solicitudes reales.</p><ol class="ob-progress" aria-label="Etapas de ensayo">'+progress+'</ol>'+body+'</section></main>');
}
function field([key,id,label],data){
 const value=esc(data[key]),optional=key==="contact_pronunciation",attrs=' id="'+id+'" name="'+key+'"'+(optional?"":" required");
 let control;
 if(key==="category")control='<select'+attrs+'><option value="">Selecciona una opción</option>'+Object.entries(categories).map(([v,l])=>'<option value="'+v+'"'+(data[key]===v?" selected":"")+'>'+esc(l)+'</option>').join("")+'</select>';
 else if(key==="interest_level")control='<select'+attrs+'><option value="">Selecciona una opción</option>'+interestLevels.map(v=>'<option value="'+v+'"'+(data[key]===v?" selected":"")+'>'+esc(interestLabels[v])+'</option>').join("")+'</select>';
 else if(key==="postal_code")control='<input'+attrs+' type="text" inputmode="numeric" maxlength="5" pattern="[0-9]{5}" value="'+value+'">';
 else if(["department","province","district"].includes(key)){
  const item={department:"Lima",province:"Huaura",district:"Huacho"}[key];
  control='<select'+attrs+'><option value="">Selecciona una opción</option><option'+(data[key]===item?" selected":"")+'>'+item+'</option></select>';
 }else control='<input'+attrs+' type="'+(key==="phone"?"tel":key.startsWith("email")?"email":"text")+'" maxlength="200" value="'+value+'"'+(key==="phone"?' pattern="\\+51[0-9]{9}"':"")+'>';
 return '<div class="ob-field"><label for="'+id+'">'+label+(optional?"":" *")+'</label>'+control+'</div>';
}
const errors={INVALID_FIELD:"Revisa los campos obligatorios y sus longitudes.",INVALID_FIELDS:"Revisa la información solicitada.",INVALID_CONTACT_OR_CATEGORY:"Comprueba el correo, teléfono y categoría.",EMAIL_MISMATCH:"Los correos electrónicos no coinciden.",PRIVACY_REQUIRED:"Confirma el aviso de privacidad de ensayo.",SYNTHETIC_ONLY:"Solo se admiten los datos sintéticos indicados.",INVALID_POSTAL_CODE:"Introduce un código postal peruano de cinco dígitos.",INVALID_INTEREST_LEVEL:"Selecciona tu estado de interés.",INVALID_LOCATION:"La ubicación debe pertenecer a la zona ilustrativa del ensayo.",DRAFT_EXPIRED:"La confirmación ha caducado. Inicia una nueva solicitud de ensayo.",DUPLICATE_BUSINESS:"Ya existe una solicitud de ensayo para este comercio.",IDEMPOTENCY_CONFLICT:"La referencia ya se usó con información diferente."};
function error(code){return code?'<p class="ob-error" role="alert">'+esc(errors[code]??"No se pudo completar la operación de ensayo.")+'</p>':"";}
function form(data={},code=""){
 return stage(1,error(code)+'<form method="post" action="/merchant/confirm"><fieldset class="ob-fields"><legend>Información del comercio</legend>'+fields.slice(0,7).map(f=>field(f,data)).join("")+'<p class="ob-small">Ubicaciones ilustrativas; no constituyen cobertura confirmada.</p></fieldset><fieldset class="ob-fields"><legend>Información del responsable</legend>'+fields.slice(7).map(f=>field(f,data)).join("")+'<div class="ob-field"><label for="observaciones">Observaciones (opcional)</label><textarea id="observaciones" name="observations" maxlength="1000" rows="3">'+esc(data.observations)+'</textarea></div><label class="ob-consent"><input type="checkbox" name="consent" value="yes" required> He leído el aviso de ensayo y usaré exclusivamente datos sintéticos.</label></fieldset><button class="ob-submit" type="submit">Continuar a confirmación</button></form>');
}
function confirmation(data,token,code=""){
 const summary=fields.filter(f=>f[0]!=="email_confirm").map(([k,,label])=>"<dt>"+esc(label)+"</dt><dd>"+esc(k==="category"?categories[data[k]]:k==="interest_level"?interestLabels[data[k]]:data[k])+"</dd>").join("")+(data.observations?"<dt>Observaciones</dt><dd>"+esc(data.observations)+"</dd>":"");
 const hidden='<input type="hidden" name="draft" value="'+esc(token)+'">';
 return stage(2,error(code)+'<h2>Revisa tu información</h2><p>Todavía no se ha registrado una solicitud. Comprueba los datos antes de confirmar.</p><dl class="ob-review">'+summary+'</dl><form method="post" action="/merchant/edit">'+hidden+'<button type="submit">Corregir información</button></form><form method="post" action="/merchant/submit">'+hidden+'<button class="ob-submit" type="submit">Enviar solicitud de ensayo</button></form>');
}
function received(id){return stage(3,'<h2>Solicitud de ensayo recibida</h2><p>Referencia: <strong>'+esc(id)+'</strong></p><p>No constituye una aceptación, contratación ni activación comercial. No se enviarán correos reales.</p><p><a href="'+localPath+'">Iniciar otro ensayo</a></p>');}
const fail=code=>{throw Error(code);};
export function validateRegistrationForm(body){
 if(!body||Object.keys(body).some(k=>![...keys,"observations","consent"].includes(k)))fail("INVALID_FIELDS");
 if(body.consent!=="yes")fail("PRIVACY_REQUIRED");
 if(typeof body.email_confirm!=="string"||typeof body.email!=="string"||body.email_confirm.trim().toLowerCase()!==body.email.trim().toLowerCase())fail("EMAIL_MISMATCH");
 if(typeof body.postal_code!=="string"||!/^\d{5}$/.test(body.postal_code))fail("INVALID_POSTAL_CODE");
 if(!interestLevels.includes(body.interest_level))fail("INVALID_INTEREST_LEVEL");
 const raw=Object.fromEntries(keys.filter(k=>k!=="email_confirm"&&body[k]!==undefined).map(k=>[k,body[k]]));
 if(body.observations!==undefined)raw.observations=body.observations;
 const d=validateMerchantInput(raw);
 if(d.department!=="Lima"||d.province!=="Huaura"||d.district!=="Huacho")fail("INVALID_LOCATION");
 if(!d.business_name.startsWith("Synthetic ")||!d.email.endsWith(".invalid")||d.phone!=="+51900000000")fail("SYNTHETIC_ONLY");
 return d;
}
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
