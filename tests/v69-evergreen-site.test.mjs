import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import vm from "node:vm";
import {assertClosedDistribution} from "../scripts/app-distribution-contract.mjs";
const root=new URL("../",import.meta.url);
const read=p=>readFileSync(new URL(p,root),"utf8");
const html=read("index.html");
const control=read("scripts/service-state.js");
const css=read("styles-system.css");
const pack=read("scripts/build-site.mjs");
const preview=read("scripts/local-preview.mjs");
test("V6.9 describes services as a lasting institutional identity, not as a startup pitch",()=>{
 assert.match(html,/<p class="hero-lead">DESSET integra una visión de comercio digital y coordinación logística, con servicios de última milla\.<\/p>/);
 assert.doesNotMatch(html,/UN ECOSISTEMA, TRES PILARES/);
 assert.match(html,/class="business-pitch"/);
 for(const phrase of ["Comercio y delivery","Logística integral","Paquetería, transporte y distribución de mercancías",
 "PROVEEDORES","COMERCIOS","PERSONAS","OPERADORES LOGÍSTICOS"])
  assert.ok(html.includes(phrase),"Missing institutional service facet "+phrase);
 assert.doesNotMatch(html,/Proyecto en desarrollo|En construcción|En desarrollo: una plataforma|Horizonte futuro|antes del lanzamiento|validar necesidades con comercios|estamos construyendo un sistema/i);
 assert.equal((html.match(/<section\b/g)||[]).length,7);
 assert.match(html,/href="#soluciones">Servicios/);
 assert.match(html,/href="#ecosistema">Cómo funciona/);
 assert.match(html,/href="\.\/contacto\.html">Canales DESSET/);
 assert.match(read("contacto.html"),/<h1>Contacto institucional<\/h1>/);
 assert.match(html,/href="#contacto"/);
});
test("V6.9 keeps website informational, operations gated to apps, no invented launch",()=>{
 assert.match(readFileSync(new URL("../empresa.html",import.meta.url),"utf8"),/Este sitio no procesa pedidos ni pagos\./);
 assert.match(readFileSync(new URL("../empresa.html",import.meta.url),"utf8"),/Este sitio no procesa pedidos ni pagos\./);
 assert.doesNotMatch(html,/data-service-access|data-service-status|data-app-links|APLICACIONES DESSET|Acceso público no habilitado/);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
 assert.equal((html.match(/data-channel-review="owner-attested" data-channel-basis="owner-attested"/g)||[]).length,5);
 assert.doesNotMatch(html,/<form\b|<iframe\b|href="https?:\/\/(?:play\.google\.com|apps\.apple\.com|wa\.me)/i);
 assertClosedDistribution(control,JSON.parse(read("config/app-distribution.json")));
 assert.doesNotMatch(control,/fetch\s*\(|localStorage|XMLHttpRequest|sendBeacon/);
});
test("Inactive application controller is a no-op with no public panel",()=>{
 let queries=0;
 const document={querySelectorAll(sel){assert.equal(sel,"[data-app-role]");queries++;return []},createElement(){throw new Error("Unexpected public UI creation")}};
 vm.runInNewContext(control,{document,URL},{timeout:700});assert.equal(queries,1);
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
 assert.doesNotMatch(built,/data-service-access|data-service-status|data-app-links|APLICACIONES DESSET|Acceso público no habilitado/);
 assert.equal(read("dist/scripts/service-state.js"),control);
 assert.ok(built.includes('href="./aplicaciones.html"'));
 assertClosedDistribution(read("dist/scripts/service-state.js"),JSON.parse(read("config/app-distribution.json")));
 const manifest=JSON.parse(read("dist/site-manifest.json"));
 assert.ok(manifest.files.some(x=>x.path==="scripts/service-state.js"));
 assert.equal(manifest.noindex,true);
});
