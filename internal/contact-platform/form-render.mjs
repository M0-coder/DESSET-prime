// Internal render candidate. The reviewed institutional HTML is the sole visual template.
const esc=v=>String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const replace=(s,a,b)=>{if(s.split(a).length!==2)throw Error("FORM_TEMPLATE_MISMATCH");return s.replace(a,()=>b);};
export async function renderManagedContact(template,{privacyVersion,privacyNotice,privacySha256,siteKey,mode="production"}={}){
 if(!["production","staging","lab"].includes(mode)||typeof template!=="string"||typeof privacyVersion!=="string"||!/^[A-Za-z0-9][A-Za-z0-9_.:-]{2,119}$/.test(privacyVersion)||typeof privacyNotice!=="string"||privacyNotice.trim().length<200||new TextEncoder().encode(privacyNotice).length>8000||!/^[a-f0-9]{64}$/.test(privacySha256??"")||typeof siteKey!=="string"||!/^[A-Za-z0-9_-]{10,128}$/.test(siteKey))throw Error("FORM_CONFIGURATION");
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(privacyNotice))),x=>x.toString(16).padStart(2,"0")).join("");
 if(hash!==privacySha256)throw Error("FORM_PRIVACY_HASH");
 if((mode!=="production")!==privacyVersion.startsWith("synthetic-"))throw Error("FORM_CONFIGURATION");
 let s=template;
 if(mode!=="lab"){s=s.replace(/(<a\b[^>]*\bhref=")\.\.\/\.\.\//g,"$1https://desset.lat/");s=replace(s," · Vista interna","");}
 s=replace(s,"connect-src 'none'",mode==="lab"?"connect-src 'self'":"connect-src 'self' https://challenges.cloudflare.com");
 if(mode!=="lab")s=replace(s,"script-src 'self'","script-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com");
 s=replace(s,'id="demo-form" method="post"','id="demo-form" data-contact-mode="managed" data-privacy-version="'+esc(privacyVersion)+'" data-site-key="'+esc(siteKey)+'" method="post"');
 s=replace(s,'Vista de prueba interna · Utiliza únicamente datos ficticios · No se envía ni almacena información.',mode==="production"?"Canal de correspondencia institucional.":"Entorno aislado: únicamente datos ficticios.");
 s=replace(s,'Los campos marcados como obligatorios deben completarse para probar el formulario.','Completa los campos marcados como obligatorios.');
 s=replace(s,'Comprendo que este es un formulario de demostración. No se enviará ni almacenará información. La política de privacidad definitiva deberá aprobarse antes de la activación.','He leído y acepto el aviso de privacidad de esta consulta.');
 s=replace(s,'          <label class="ct-consent">','          <section aria-label="Aviso de privacidad"><h3>Aviso de privacidad</h3><p>'+esc(privacyNotice)+'</p></section>\n          <label class="ct-consent">');
 s=replace(s,'<button class="ct-send" type="submit" disabled>Simular envío</button>','<div id="contact-challenge"></div><button class="ct-send" type="submit" disabled>Enviar consulta</button>');
 s=replace(s,'<h2>Simulación completada</h2><p>El formulario ha superado la validación local. No se ha enviado ni almacenado ninguna consulta.</p>','<h2>Consulta recibida</h2><p></p>');
 s=replace(s,'Canal en fase de diseño. Sin recepción de mensajes en esta vista interna.','La recepción no implica una respuesta inmediata.');
 s=replace(s,'Describe tu consulta con datos de ejemplo.',mode==="production"?"Describe tu consulta.":"Describe tu consulta con datos ficticios.");
 s=replace(s,'</head>',mode==="lab"?'<script type="module" src="/__fixture/d1-bridge.mjs"></script></head>':'<script type="module" src="/internal/contact-platform/form-entry.mjs"></script></head>');
 return s;
}
