/* APP-DISTRIBUTION-01. Canonical projection of config/app-distribution.json; checked offline. No tracking, network or storage. */
(()=>{
"use strict";
const registry={"schema":"desset-app-distribution-v1","policy":"closed","queryCountry":"PE","apps":[{"id":"clientes","audience":"Clientes","officialName":null,"activation":"not_enabled","coverage":[],"qr":null,"platforms":{"android":{"status":"not_published","verified":false,"storeId":null,"developer":null,"compatibility":null,"url":null,"countries":[],"evidence":[]},"ios":{"status":"not_published","verified":false,"storeId":null,"developer":null,"compatibility":null,"url":null,"countries":[],"evidence":[]}}},{"id":"comercios","audience":"Comercios","officialName":null,"activation":"not_enabled","coverage":[],"qr":null,"platforms":{"android":{"status":"not_published","verified":false,"storeId":null,"developer":null,"compatibility":null,"url":null,"countries":[],"evidence":[]},"ios":{"status":"not_published","verified":false,"storeId":null,"developer":null,"compatibility":null,"url":null,"countries":[],"evidence":[]}}},{"id":"repartidores","audience":"Repartidores","officialName":null,"activation":"not_enabled","coverage":[],"qr":null,"platforms":{"android":{"status":"not_published","verified":false,"storeId":null,"developer":null,"compatibility":null,"url":null,"countries":[],"evidence":[]},"ios":{"status":"not_published","verified":false,"storeId":null,"developer":null,"compatibility":null,"url":null,"countries":[],"evidence":[]}}}]};
const roles=new Map(registry.apps.map(x=>[x.id,x]));
function officialListing(app,platform,country){
 if(!app||typeof app.officialName!=="string"||!app.officialName.trim()||!["android","ios"].includes(platform)||!/^[A-Z]{2}$/.test(country))return null;
 const s=app.platforms?.[platform];
 if(!s||s.status!=="published"||s.verified!==true||typeof s.developer!=="string"||!s.developer.trim()||typeof s.compatibility!=="string"||!s.compatibility.trim()||!s.countries?.includes(country)||typeof s.storeId!=="string")return null;
 const e=s.evidence?.filter(x=>x.country===country&&x.storeId===s.storeId&&x.developer===s.developer&&x.url===s.url&&typeof x.reference==="string"&&x.reference.trim()&&/^\d{4}-\d{2}-\d{2}$/.test(x.checkedOn));
 if(e?.length!==1)return null;
 const id=s.storeId;
 const exact=platform==="android"&&/^[a-zA-Z][a-zA-Z0-9_]*(?:\.[a-zA-Z][a-zA-Z0-9_]*)+$/.test(id)?"https://play.google.com/store/apps/details?id="+id:
 platform==="ios"&&/^[1-9]\d{5,19}$/.test(id)?"https://apps.apple.com/"+country.toLowerCase()+"/app/id"+id:null;
 if(!exact||s.url!==exact)return null;
 return {url:exact,label:platform==="android"?"Google Play":"App Store",compatibility:s.compatibility};
}
function suggestDevice(ua){
 if(/Android/i.test(ua))return "android";
 if(/iPhone|iPad|iPod/i.test(ua))return "ios";
 return "desktop";
}
if(registry.policy!=="closed"&&registry.policy!=="approved")return;
const panels=document.querySelectorAll("[data-app-role]");
if(!panels.length)return;
const countryControl=document.querySelector("[data-app-country]");
let device=suggestDevice(typeof navigator==="object"?navigator.userAgent:"");
function render(){
 const country=countryControl?.value||registry.queryCountry;
 for(const panel of panels){
  const app=roles.get(panel.dataset.appRole),download=panel.querySelector("[data-app-download]"),links=panel.querySelector("[data-app-links]");
  const releases=registry.policy==="approved"?[...(device==="ios"?["ios","android"]:["android","ios"])].map(p=>officialListing(app,p,country)).filter(Boolean):[];
  if(download)download.textContent=releases.length?"Descarga disponible para la plataforma indicada.":"Descarga no disponible.";
  if(links){
   links.replaceChildren();links.hidden=!releases.length;
   for(const item of releases){const a=document.createElement("a");a.href=item.url;a.textContent=item.label+" · "+item.compatibility;a.rel="noopener noreferrer";links.appendChild(a);}
  }
  const buttons=panel.querySelectorAll("[data-app-platform]");
  for(const button of buttons)button.setAttribute("aria-pressed",String(button.dataset.appPlatform===device));
  const deviceStatus=panel.querySelector("[data-app-device-status]");
  if(deviceStatus)deviceStatus.textContent=device==="android"?"Android seleccionado.":device==="ios"?"iPhone seleccionado.":"Ordenador seleccionado.";
  // Account activation and local coverage are never inferred from store availability.
 }
}
for(const panel of panels){
 const group=panel.querySelector("[data-app-platforms]");
 if(group)group.hidden=false;
 for(const button of panel.querySelectorAll("[data-app-platform]"))button.addEventListener("click",()=>{device=button.dataset.appPlatform;render();});
}
countryControl?.addEventListener("change",render);
render();
})();
