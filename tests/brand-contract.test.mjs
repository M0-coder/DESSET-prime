import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
const app=readFileSync(new URL("../scripts/app.js",import.meta.url),"utf8");
const mark=readFileSync(new URL("../assets/deliver-assets-mark.png",import.meta.url));
const roles=readFileSync(new URL("../assets/roles-geometry-v2.svg",import.meta.url));
const gitBlob=x=>createHash("sha1").update("blob "+x.length+"\0").update(x).digest("hex");
test("activos históricos originales sin alteración",()=>{
 assert.equal(gitBlob(mark),"fa6cb4ea5c5331c4cf47dfd157214e972f809356");
 assert.equal(gitBlob(roles),"71401c4d0f93eeefcde393f18e82e165e50d8f90");
 assert.match(html,/assets\/deliver-assets-mark\.png/);
 assert.match(html,/assets\/roles-geometry-v2\.svg/);
});
test("estructura pública informativa y alcance responsable",()=>{
 for(const id of ["inicio","vision","soluciones","ecosistema","negocios","contacto"])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(html,/No procesa pedidos ni pagos/i);
 assert.match(html,/Horizonte futuro/);
 assert.match(html,/conceptual/i);
 assert.doesNotMatch(html,/>\s*(Pedir ahora|Hacer un pedido|Iniciar sesión|Descarga la app)/i);
 assert.doesNotMatch(html,/[+]\s*[0-9]+\s*(clientes|repartidores|pedidos|negocios)/i);
});
test("navegación, accesibilidad y seguridad de vista previa",()=>{
 assert.match(html,/Saltar al contenido/);
 assert.match(html,/aria-expanded="false"/);
 assert.match(app,/event\.key==="Escape"/);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
 assert.match(html,/Content-Security-Policy/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.doesNotMatch(html,/<form[\s>]/i);
 assert.doesNotMatch(html,/href="#"/);
});
test("sin dependencia de hojas duplicadas, marca ficticia ni imágenes de stock",()=>{
 assert.equal((html.match(/rel="stylesheet"/g)||[]).length,1);
 assert.doesNotMatch(css,/\.art-center\{|\.hero-art\{|@keyframes arrive/);
 assert.doesNotMatch(html,/https?:\/\/images\./);
});
