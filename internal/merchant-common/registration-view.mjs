// Shared renderer and input contract; no Node-specific imports.
import {validateMerchantInput,interestLevels} from "./validation.mjs";
import {resolveTerritory} from "./territory.mjs";
import {locationControl,shortInterestLabels} from "./location-ui.mjs";
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const categories={restaurant:"Restaurantes y gastronomía",grocery:"Supermercados y bodegas",bakery:"Panaderías y pastelerías",specialty:"Tiendas especializadas",pharmacy:"Farmacias",other:"Otros comercios"};
const interestLabels={ready:"Deseo incorporarme cuando se habilite",soon:"Planeo incorporarme próximamente",evaluating:"Estoy evaluando la incorporación",information:"Deseo recibir información"};
const fields=[
 ["business_name","nombre-comercial","Nombre comercial"],["category","categoria","Tipo de comercio"],
 ["department","departamento","Departamento"],["province","provincia","Provincia"],["district","distrito","Distrito"],["postal_code","codigo-postal","Código postal"],["address","direccion","Dirección del establecimiento"],
 ["contact_name","responsable","Nombres y apellidos"],["contact_pronunciation","pronunciacion","Pronunciación del nombre (opcional)"],["phone","telefono","Teléfono"],["email","correo","Correo electrónico"],["email_confirm","confirmar-correo","Confirmar correo electrónico"],["interest_level","interes","Estado de interés en la incorporación"]
];
const keys=fields.map(f=>f[0]);

export const privateStyle=".onboarding-page .ob-submit:not(:disabled){background:#073BBC;color:#fff;cursor:pointer}.onboarding-page .ob-submit:focus-visible{outline:3px solid #000;outline-offset:3px}.onboarding-page .ob-error{border-left:4px solid #B42419;padding:12px;color:#B42419}.onboarding-page .ob-review dt{font-weight:750}.onboarding-page .ob-review dd{margin:4px 0 16px;overflow-wrap:anywhere}";
export const privateAdminStyle=`.merchant-admin{margin:0;background:#F7F5EE;color:#000000;font:16px/1.55 Inter,Arial,sans-serif}.merchant-admin main{max-width:1040px;margin:auto;padding:clamp(20px,4vw,48px);overflow-wrap:anywhere}.merchant-admin h1{font-size:clamp(26px,4vw,38px);line-height:1.2;margin:0 0 16px}.merchant-admin h2{font-size:22px;line-height:1.3;margin:0 0 12px}.merchant-admin article{border:1px solid #d8dce2;border-radius:12px;padding:clamp(16px,3vw,24px);background:#fff;margin:20px 0}.merchant-admin p{margin:8px 0}.merchant-admin article form,.merchant-admin form[action="/logout"]{display:flex;gap:12px;flex-wrap:wrap;margin:16px 0}.merchant-admin button,.onboarding-page .ob-edit{min-height:48px;padding:10px 16px;border:1px solid #073BBC;border-radius:8px;color:#073BBC;background:#fff;font:inherit;font-weight:700;cursor:pointer}.onboarding-page .ob-edit{width:100%;margin:0 0 12px}.merchant-admin button[value="APPROVED"]{background:#073BBC;color:#fff}.merchant-admin button[value="REJECTED"]{border-color:#000;color:#000}.merchant-admin button:focus-visible,.onboarding-page .ob-edit:focus-visible{outline:3px solid #000;outline-offset:3px}.merchant-admin input[type="password"]{display:block;box-sizing:border-box;max-width:100%;min-height:48px;padding:12px;border:1px solid #c8d1df;border-radius:8px;font:inherit;margin:8px 0}.merchant-admin a{color:#073BBC}.merchant-admin .admin-brand{display:flex;align-items:center;gap:12px;margin-bottom:20px;font-weight:800}.merchant-admin .admin-brand img{width:46px;height:auto}@media(max-width:390px){.onboarding-page select{padding-inline:6px}.merchant-admin article form button{width:100%}}`;


export function createRegistrationShell(template,localPath,assetPrefix="/",cssPath="/merchant-registration.css",production=false){
 return function shell(main){
  if(!/<main class="onboarding-page" id="contenido">[\s\S]*?<\/main>/.test(template))throw Error("REGISTRATION_TEMPLATE_CHANGED");
  return template.replace(/<main class="onboarding-page" id="contenido">[\s\S]*?<\/main>/,()=>main)
   .replace("form-action 'none'","form-action 'self'")
   .replace("script-src 'self'",production?"script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com":"script-src 'self'")
   .replace(/href="\.\/(?:index|comercios|incorporacion-comercios)\.html"/g,'href="'+localPath+'"')
   .replace(/\b(href|src)="\.\/(?!\.\/)/g,'$1="'+assetPrefix)
   .replace("</head>",'<link rel="stylesheet" href="'+cssPath+'"></head>');
 };
}
export function createRegistrationRenderer({shell,localPath="/registro-comercios.html",routeBase="/merchant",scriptPath="/merchant-territory.js",csrf=null,production=false,privacyUrl="",siteKey=""}){
 const notice=production?"Solicita la incorporación de tu establecimiento. La solicitud será evaluada antes de contratar o activar el servicio.":"Entorno privado de ensayo. Usa únicamente datos sintéticos: nombre comercial que comience por Synthetic, teléfono +51900000000 y correo terminado en .invalid. No se aceptan solicitudes reales.";
 const privacy=production?'He leído el <a href="'+esc(privacyUrl)+'">aviso de privacidad</a> y solicito la incorporación.':"He leído el aviso de ensayo y usaré exclusivamente datos sintéticos.";
 const challenge=production?'<div class="cf-turnstile" data-sitekey="'+esc(siteKey)+'" data-action="merchant_intake"></div><script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>':"";
 const csrfField=csrf===null?"":'<input type="hidden" name="csrf" value="'+esc(csrf)+'">';
 function stage(n,body){
 const progress=["Información","Confirmación","Recepción"].map((v,i)=>"<li"+(i+1===n?' aria-current="step"':"")+"><strong>0"+(i+1)+"</strong> "+v+"</li>").join("");
 return shell('<main class="onboarding-page" id="contenido"><section class="ob-hero"><p class="ob-kicker">DESSET / COMERCIOS</p><h1>Registra tu comercio.</h1><p>El primer paso para formar parte de DESSET.</p></section><section class="ob-inner" aria-label="Incorporación comercial"><p class="ob-notice">'+esc(notice)+'</p><ol class="ob-progress" aria-label="Etapas de incorporación">'+progress+'</ol>'+body+'</section></main>');
}
function field([key,id,label],data){
 const value=esc(data[key]),optional=key==="contact_pronunciation",attrs=' id="'+id+'" name="'+key+'"'+(optional?"":" required");
 let control;
 if(key==="category")control='<select'+attrs+'><option value="">Selecciona una opción</option>'+Object.entries(categories).map(([v,l])=>'<option value="'+v+'"'+(data[key]===v?" selected":"")+'>'+esc(l)+'</option>').join("")+'</select>';
 else if(key==="interest_level")control='<select'+attrs+'><option value="">Selecciona una opción</option>'+interestLevels.map(v=>'<option value="'+v+'"'+(data[key]===v?" selected":"")+'>'+esc(shortInterestLabels[v])+'</option>').join("")+'</select>';
 else if(key==="postal_code")control='<input'+attrs+' type="text" inputmode="numeric" maxlength="5" pattern="[0-9]{5}" value="'+value+'">';
 else if(["department","province","district"].includes(key)){
  control=locationControl(key,attrs,data);
 }else control='<input'+attrs+' type="'+(key==="phone"?"tel":key.startsWith("email")?"email":"text")+'" maxlength="200" value="'+value+'"'+(key==="phone"?' pattern="\\+51[0-9]{9}"':"")+'>';
 return '<div class="ob-field"><label for="'+id+'">'+label+(optional?"":" *")+'</label>'+control+'</div>';
}
const errors={INVALID_FIELD:"Revisa los campos obligatorios y sus longitudes.",INVALID_FIELDS:"Revisa la información solicitada.",INVALID_CONTACT_OR_CATEGORY:"Comprueba el correo, teléfono y categoría.",EMAIL_MISMATCH:"Los correos electrónicos no coinciden.",PRIVACY_REQUIRED:"Confirma el aviso de privacidad.",SYNTHETIC_ONLY:"Solo se admiten los datos sintéticos indicados.",INVALID_POSTAL_CODE:"Introduce un código postal peruano de cinco dígitos.",INVALID_INTEREST_LEVEL:"Selecciona tu estado de interés.",INVALID_LOCATION:"Selecciona un departamento, provincia y distrito compatibles.",DRAFT_EXPIRED:"La confirmación ha caducado. Inicia una nueva solicitud.",DUPLICATE_BUSINESS:"Ya existe una solicitud para este comercio.",IDEMPOTENCY_CONFLICT:"La referencia ya se usó con información diferente."};
function error(code){return code?'<p class="ob-error" role="alert">'+esc(errors[code]??"No se pudo completar la operación.")+'</p>':"";}
function form(data={},code=""){
 return stage(1,error(code)+'<form method="post" action="'+routeBase+'/confirm">'+csrfField+'<fieldset class="ob-fields"><legend>Información del comercio</legend>'+fields.slice(0,7).map(f=>field(f,data)).join("")+'<p class="ob-small">Catálogo territorial; la ubicación no constituye cobertura confirmada.</p></fieldset><fieldset class="ob-fields"><legend>Información del responsable</legend>'+fields.slice(7).map(f=>field(f,data)).join("")+'<div class="ob-field"><label for="observaciones">Observaciones (opcional)</label><textarea id="observaciones" name="observations" maxlength="1000" rows="3">'+esc(data.observations)+'</textarea></div><label class="ob-consent"><input type="checkbox" name="consent" value="yes" required> '+privacy+'</label></fieldset>'+challenge+'<button class="ob-submit" type="submit">Continuar a confirmación</button></form><script src="'+scriptPath+'" defer></script>');
}
function confirmation(data,token,code=""){
 const summary=fields.filter(f=>f[0]!=="email_confirm").map(([k,,label])=>"<dt>"+esc(label)+"</dt><dd>"+esc(k==="category"?categories[data[k]]:k==="interest_level"?interestLabels[data[k]]:data[k])+"</dd>").join("")+(data.observations?"<dt>Observaciones</dt><dd>"+esc(data.observations)+"</dd>":"");
 const hidden='<input type="hidden" name="draft" value="'+esc(token)+'">';
 return stage(2,error(code)+'<h2>Revisa tu información</h2><p>Todavía no se ha registrado una solicitud. Comprueba los datos antes de confirmar.</p><dl class="ob-review">'+summary+'</dl><form method="post" action="'+routeBase+'/edit">'+csrfField+hidden+'<button class="ob-edit" type="submit">Corregir información</button></form><form method="post" action="'+routeBase+'/submit">'+csrfField+hidden+'<button class="ob-submit" type="submit">'+(production?"Enviar solicitud":"Enviar solicitud de ensayo")+'</button></form>');
}
function received(id){return stage(3,'<h2>'+(production?"Solicitud recibida":"Solicitud de ensayo recibida")+'</h2><p>Referencia: <strong>'+esc(id)+'</strong></p><p>No constituye una aceptación, contratación ni activación comercial.'+(production?" Nuestro equipo revisará tu solicitud y se comunicará contigo.":" No se enviarán correos reales.")+'</p><p><a href="'+localPath+'">'+(production?"Volver al formulario":"Iniciar otro ensayo")+'</a></p>');}

 return {form,confirmation,received};
}
const fail=code=>{throw Error(code);};
export function validateRegistrationForm(body,{synthetic=true}={}){
 if(!body||Object.keys(body).some(k=>![...keys,"observations","consent"].includes(k)))fail("INVALID_FIELDS");
 if(body.consent!=="yes")fail("PRIVACY_REQUIRED");
 if(typeof body.email_confirm!=="string"||typeof body.email!=="string"||body.email_confirm.trim().toLowerCase()!==body.email.trim().toLowerCase())fail("EMAIL_MISMATCH");
 if(typeof body.postal_code!=="string"||!/^\d{5}$/.test(body.postal_code))fail("INVALID_POSTAL_CODE");
 if(!interestLevels.includes(body.interest_level))fail("INVALID_INTEREST_LEVEL");
 const raw=Object.fromEntries(keys.filter(k=>k!=="email_confirm"&&body[k]!==undefined).map(k=>[k,body[k]]));
 if(body.observations!==undefined)raw.observations=body.observations;
 const d=validateMerchantInput(raw);
 const location=resolveTerritory(d.department,d.province,d.district);
 d.department=location.department;d.province=location.province;d.district=location.district;
 if(synthetic&&(!d.business_name.startsWith("Synthetic ")||!d.email.endsWith(".invalid")||d.phone!=="+51900000000"))fail("SYNTHETIC_ONLY");
 if(!synthetic&&(d.business_name.startsWith("Synthetic ")||d.email.endsWith(".invalid")))fail("INVALID_CONTACT_OR_CATEGORY");
 return d;
}
