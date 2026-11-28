// Render ONLY a private activation rehearsal from the existing institutional pages.
// No runtime networking, public output, configuration mutation or authority to enable intake.
export const contactCategoryIds=Object.freeze(["alianzas","inversion","marketing","prensa","instituciones","profesionales","legal","seguridad","otras"]);
export const contactCandidateOrigin="https://contacto.desset.lat";
export const contactCandidateUrl=category=>{
 if(!contactCategoryIds.includes(category))throw Error("CONTACT_CATEGORY");
 return contactCandidateOrigin+"/internal/contact-ready/index.html#consulta-"+category;
};
const replace=(s,a,b)=>{if(s.split(a).length!==2)throw Error("CONTACT_COPY_MISMATCH");return s.replace(a,()=>b);};
export function prepareContactLinkRehearsal(pages){
 if(!pages||Object.keys(pages).sort().join(",")!=="confianza,contacto,en,noticias")throw Error("CONTACT_PAGE_SET");
 for(const page of Object.values(pages))if(typeof page!=="string"||!page.includes('name="robots" content="noindex,nofollow"')||!page.includes("form-action 'none'")||page.includes(contactCandidateOrigin))throw Error("CONTACT_PAGE_STATE");
 let {contacto,confianza,noticias,en}=pages;
 contacto=replace(contacto,"Los canales de recepción se habilitarán cuando estén preparados. Por ahora puedes consultar las áreas de relación; esta página no recibe mensajes ni datos personales.","Vista de activación para revisión interna. Los destinos son candidatos, no canales operativos; esta página no recibe datos personales.");
 for(const category of contactCategoryIds){
  const pattern=new RegExp('<details class="ct-item" id="'+category+'">[\\s\\S]*?<\\/details>','g');
  const matches=[...contacto.matchAll(pattern)];
  if(matches.length!==1)throw Error("CONTACT_DIRECTORY");
  const part=matches[0][0];
  contacto=replace(contacto,part,replace(part,"El canal correspondiente aún no está habilitado.",'Destino previsto: <a href="'+contactCandidateUrl(category)+'" rel="noreferrer">Formulario de '+category+' (candidato no habilitado)</a>.'));
 }
 confianza=replace(confianza,"La recepción de reportes aún no está habilitada.","La recepción de reportes aún no está habilitada. El acceso previsto se encuentra en la categoría de seguridad y privacidad.");
 noticias=replace(noticias,"El canal de solicitudes aún no está habilitado.","El canal de solicitudes aún no está habilitado. El acceso previsto se encuentra en la categoría de prensa.");
 en=replace(en,"Commercial availability, recruitment and institutional reception channels are not announced as active here.","Commercial availability, recruitment and institutional reception channels are not announced as active here. The Spanish contact directory provides the planned institutional routes.");
 return Object.freeze({contacto,confianza,noticias,en});
}
