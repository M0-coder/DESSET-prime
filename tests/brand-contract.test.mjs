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
 assert.doesNotMatch(html,/assets\/roles-geometry-(?:mobile-)?es\.svg/);
});
test("estructura pública informativa y alcance responsable",()=>{
 for(const id of ["inicio","vision","soluciones","ecosistema","negocios","contacto"])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(readFileSync(new URL("../empresa.html",import.meta.url),"utf8"),/Este sitio no procesa pedidos ni pagos\./);
 assert.doesNotMatch(html,/Conocer otras áreas del ecosistema/);
 assert.match(html,/<h3>DESSET <span>prime<\/span><\/h3>/);
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
 const stylesheets=[...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map(match=>match[1]);
 const mainCss=readFileSync(new URL("../styles.css",import.meta.url));
 assert.deepEqual(stylesheets,["./styles.css?v="+gitBlob(mainCss),"./styles-v5.css","./styles-system.css","./styles-hero-photo.css","./styles-visual02.css","./styles-typography.css","./styles-service-video.css"],"Only the seven exact, audited, local stylesheets are permitted, including separately licensed typography");
 assert.doesNotMatch(css,/\.art-center\{|\.hero-art\{|@keyframes arrive/);
 assert.doesNotMatch(html,/https?:\/\/images\./);
});
