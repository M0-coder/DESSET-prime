import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
const root=new URL("../",import.meta.url);
const read=p=>readFileSync(new URL(p,root),"utf8");
const html=read("index.html");
const control=read("scripts/service-state.js");
const css=read("styles-system.css");
const pack=read("scripts/build-site.mjs");
const preview=read("scripts/local-preview.mjs");
function simulate(source=control){
 const links={hidden:true,children:[],
  replaceChildren(fragment){this.children=[...fragment.children]}};
 const status={textContent:"Acceso público no habilitado"};
 const panel={dataset:{},querySelector(sel){
  if(sel==="[data-service-status]")return status;
  if(sel==="[data-app-links]")return links;
  return null;
 }};
 const document={
  querySelector(sel){return sel==="[data-service-access]"?panel:null},
  createDocumentFragment(){return {children:[],appendChild(node){this.children.push(node)}}},
  createElement(tag){assert.equal(tag,"a");return {}}
 };
 vm.runInNewContext(source,{document,URL}, {timeout:700});
 return {panel,status,links};
}
test("V6.9 describes services as a lasting institutional identity, not as a startup pitch",()=>{
 assert.match(html,/DESSET reúne comercio, tecnología y logística en un ecosistema de servicios/);
 assert.match(html,/UN ECOSISTEMA, TRES PILARES/);
 for(const phrase of ["Comercio conectado","Logística de última milla","Tecnología DESSET",
 "Pedidos y","Paquetería y transporte","Comercio y servicios",
 "Elegir, preparar","APLICACIONES DESSET"])
  assert.ok(html.includes(phrase),"Missing institutional service facet "+phrase);
 assert.doesNotMatch(html,/Proyecto en desarrollo|En construcción|En desarrollo: una plataforma|Horizonte futuro|antes del lanzamiento|validar necesidades con comercios|estamos construyendo un sistema/i);
 assert.equal((html.match(/<section\b/g)||[]).length,6);
 assert.match(html,/href="#soluciones">Servicios/);
 assert.match(html,/href="#ecosistema">Cómo funciona/);
 assert.match(html,/href="#contacto">Canales DESSET/);
});
test("V6.9 keeps website informational, operations gated to apps, no invented launch",()=>{
 assert.match(html,/Sitio institucional: los pedidos y pagos corresponden a las aplicaciones DESSET cuando estén habilitadas/);
 assert.match(html,/Este sitio no procesa pedidos ni pagos/);
 assert.match(html,/data-service-status role="status" aria-live="polite">Acceso público no habilitado/);
 assert.match(html,/data-app-links hidden/);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
 assert.equal((html.match(/data-channel-review="verified" data-channel-basis="owner-attested"/g)||[]).length,3);
 assert.doesNotMatch(html,/<form\b|<iframe\b|href="https?:\/\/(?:play\.google\.com|apps\.apple\.com|wa\.me)/i);
 assert.match(control,/applicationDistribution:"not_published"/);
 assert.match(control,/verified:false/);
 assert.doesNotMatch(control,/fetch\s*\(|localStorage|XMLHttpRequest|sendBeacon/);
});
test("V6.9 default availability controller never falsely displays applications as launched",()=>{
 const result=simulate();
 assert.equal(result.panel.dataset.applicationAvailability,"not-published");
 assert.equal(result.status.textContent,"Acceso público no habilitado");
 assert.equal(result.links.hidden,true);
 assert.equal(result.links.children.length,0);
});
test("V6.9 status cannot be promoted by toggling a flag without verified store URLs",()=>{
 const onlyFlag=control.replace('applicationDistribution:"not_published"','applicationDistribution:"published"');
 const result=simulate(onlyFlag);
 assert.equal(result.panel.dataset.applicationAvailability,"not-published");
 assert.equal(result.links.children.length,0);
});
test("V6.9 store URL guard rejects untrusted links and only renders verified official listings",()=>{
 const modify=(url,verified)=>{
  let source=control.replace('applicationDistribution:"not_published"','applicationDistribution:"published"');
  source=source.replace('android:Object.freeze({url:null,verified:false})',
    'android:Object.freeze({url:"'+url+'",verified:'+String(verified)+'})');
  return simulate(source);
 };
 const bad=modify("https://play.google.com.evil.example/store/apps/details?id=example",true);
 assert.equal(bad.links.children.length,0);
 const noVerify=modify("https://play.google.com/store/apps/details?id=sample",false);
 assert.equal(noVerify.links.children.length,0);
 const good=modify("https://play.google.com/store/apps/details?id=sample",true);
 assert.equal(good.panel.dataset.applicationAvailability,"published");
 assert.equal(good.status.textContent,"Aplicaciones publicadas");
 assert.equal(good.links.hidden,false);
 assert.equal(good.links.children.length,1);
 assert.equal(good.links.children[0].rel,"noopener noreferrer");
 assert.equal(good.links.children[0].textContent,"Google Play");
});
test("V6.9 actual web package and UI contains the single activation point",()=>{
 assert.match(pack,/"scripts\/service-state\.js"/);
 assert.match(pack,/service-state\)\\\.js/);
 assert.match(preview,/service-state\)\\\.js/);
 assert.match(css,/\.service-access\{/);
 assert.match(css,/\.service-access__status\{/);
 assert.match(css,/@media\(max-width:700px\)/);
 const built=read("dist/index.html");
 assert.ok(built.includes('src="./scripts/service-state.js"'));
 assert.equal(read("dist/scripts/service-state.js"),control);
 const manifest=JSON.parse(read("dist/site-manifest.json"));
 assert.ok(manifest.files.some(x=>x.path==="scripts/service-state.js"));
 assert.equal(manifest.noindex,true);
});
