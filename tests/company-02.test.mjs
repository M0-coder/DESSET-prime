import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {companyFiles,companyRoutes,companyTitles,companyCss} from "../scripts/company-routes.mjs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const anchors={"mensaje-direccion":"mensaje-direccion","quienes-somos":"perfil-corporativo","areas":"perfil-corporativo","informacion-corporativa":"perfil-corporativo","proposito":"mision-vision-valores","mision-vision":"mision-vision-valores","valores":"mision-vision-valores","principios-actuacion":"principios","gobierno-responsabilidad":"gobierno-corporativo","historia":"historia","inversores":"inversores","inversores-negocio":"inversores","inversores-documentos":"inversores","inversores-contacto":"inversores"};
for(const dir of ["","dist/"])test("COMPANY-02 modular directory, legacy anchors, local content and unchanged restrictions "+(dir||"source"),()=>{
 const hub=read(dir+"empresa.html");
 assert.match(hub,/<main class="company-page company-hub"/);
 const routes=[...hub.matchAll(/<section id="[^"]+" class="co-card">[\s\S]*?<a href="\.\/([a-z-]+\.html)">/g)].map(x=>x[1]);
 assert.deepEqual(routes,companyFiles);
 const photos=[...hub.matchAll(/<span class="co-art co-photo"[^>]*><img src="\.\/([^"]+)"/g)].map(x=>x[1]);
 assert.deepEqual(photos,["assets/desset-hero-entrega-dos-espejos.webp","assets/scene-choose.webp","assets/scene-prepare.webp"]);assert.equal((hub.match(/loading="eager" decoding="sync"/g)||[]).length,3,"Corporate directory photos must load and decode without deferred offscreen capture");
 const originals=JSON.parse(read("config/prime-original-assets.json")).assets;
 for(const path of photos)assert.ok(originals.some(a=>a.path===path&&a.claim==="owner-declared"));
 assert.doesNotMatch(hub,/<span class="co-art"[^>]*><svg/);
 for(const [id,route] of Object.entries({areas:"perfil-corporativo","informacion-corporativa":"perfil-corporativo",proposito:"mision-vision-valores",valores:"mision-vision-valores"}))assert.ok(hub.includes('id="'+id+'" href="./'+route+'.html#'+id+'"'));
 for(const [id,route] of Object.entries(anchors)){
  assert.equal((hub.match(new RegExp('id="'+id+'"','g'))||[]).length,1,"legacy anchor "+id);
  assert.ok(read(dir+route+".html").includes('id="'+id+'"'),"detail anchor "+id);
 }
 for(const route of companyRoutes){
  const doc=read(dir+route+".html");assert.match(doc,/<main class="company-page company-detail"/);
  assert.ok(doc.includes("<h1>"+companyTitles[route]+"</h1>"));assert.ok([...doc.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].every(x=>x[1].trim().replace(/[.]$/,"")!==companyTitles[route]),"Repeated title: "+route);
  assert.ok(doc.includes('href="./'+companyCss+'"'));
  assert.ok(doc.includes('href="./empresa.html">Volver a Empresa</a>'));
  assert.match(doc,/name="robots" content="noindex,nofollow"/);
  assert.match(doc,/form-action 'none'/);assert.doesNotMatch(doc,/<(?:form|iframe|input|video)\b/i);
 }
 const investor=read(dir+"inversores.html"),governance=read(dir+"gobierno-corporativo.html");
 assert.match(investor,/No existe un mecanismo de captación de fondos/);
 assert.match(governance,/La estructura jurídica y las responsabilidades formales se comunicarán cuando exista documentación acreditada/);
 assert.doesNotMatch(read(dir+"index.html"),/styles-company\.css/);
 assert.ok(Buffer.byteLength(read(dir+companyCss))<=4500);
});