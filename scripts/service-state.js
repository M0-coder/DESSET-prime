/* DESSET V6.9 — institutional presentation with independently configurable
 * application distribution. This site never accepts orders or payments.
 * Availability is NOT inferred from the presence of a link; a verified
 * publication and explicit status change are both required.
 * No network calls, cookies, analytics or local storage. */
(()=>{
 "use strict";
 const config=Object.freeze({
  applicationDistribution:"not_published", // "published" only after verified release
  android:Object.freeze({url:null,verified:false}),
  ios:Object.freeze({url:null,verified:false})
 });
 const panel=document.querySelector("[data-service-access]");
 const label=panel?.querySelector("[data-service-status]");
 const links=panel?.querySelector("[data-app-links]");
 if(!panel||!label||!links)return;
 panel.dataset.applicationAvailability="not-published";
 const stores=Object.freeze([
  Object.freeze({key:"android",host:"play.google.com",pathname:"/store/apps/details",label:"Google Play"}),
  Object.freeze({key:"ios",host:"apps.apple.com",pathname:"/",label:"App Store"})
 ]);
 const releases=[];
 for(const store of stores){
  const entry=config[store.key];
  if(!entry.verified||typeof entry.url!=="string")continue;
  let url;
  try{url=new URL(entry.url)}catch{continue}
  if(url.protocol!=="https:"||url.hostname!==store.host||!url.pathname.startsWith(store.pathname))continue;
  releases.push({url:url.href,label:store.label});
 }
 // Changing the label to available requires BOTH an authorized status and
 // a verified store listing, never just a design/UI adjustment.
 if(config.applicationDistribution!=="published"||releases.length===0){
  label.textContent="Acceso público no habilitado";
  links.hidden=true;
  return;
 }
 label.textContent="Aplicaciones publicadas";
 panel.dataset.applicationAvailability="published";
 const fragment=document.createDocumentFragment();
 for(const release of releases){
  const a=document.createElement("a");
  a.href=release.url;a.rel="noopener noreferrer";a.target="_blank";
  a.textContent=release.label;fragment.appendChild(a);
 }
 links.replaceChildren(fragment);
 links.hidden=false;
})();
