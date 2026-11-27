import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
const app=readFileSync(new URL("../scripts/app.js",import.meta.url),"utf8");
const head=html.split('<section id="inicio" class="hero hero--motion"')[1]?.split('<section class="statement"')[0]||"";
test("V4: portada comercial editorial con mensaje legible, CTA reales y sin operaciones fingidas",()=>{
 assert.ok(head.length>1500);
 assert.match(head,/class="motion-line v4-headline-a"><span class="motion-line__inner">TU TIEMPO<\/span>/);
 assert.match(head,/class="motion-line v4-headline-b"><span class="motion-line__inner">VALE MÁS<\/span>/);
 for(const keyword of ["COMERCIO","LOGÍSTICA","CONEXIÓN","DISTRIBUCIÓN","VALE MÁS"])assert.match(head,new RegExp(keyword));
 assert.match(head,/Conectamos personas, negocios y mercados/i);
 assert.doesNotMatch(head,/v4-hero-declaration|COMERCIO · TECNOLOGÍA · LOGÍSTICA/);
 assert.match(head,/href="\.\/mision-vision-valores\.html#proposito"/);
 assert.doesNotMatch(head,/href="#ecosistema"/);
 assert.match(html,/class="service-body" id="ecosistema"/);assert.doesNotMatch(html,/<section class="ecosystem"/);
 assert.match(head,/v4-motion-canvas/);
 assert.doesNotMatch(head,/roles-geometry-v2\.svg|system-illustration|Cuatro funciones conectadas/);
 assert.doesNotMatch(head,/Huacho|clientes activos|seguimiento en tiempo real|descarga la app|operación en vivo/i);
});
test("V4: identidad visual original y movimiento finito + accesible",()=>{
 assert.match(css,/--blue:#073BBC/);
 assert.match(css,/--yellow:#FFC62F/);
 assert.match(css,/--red:#FF3328/);
 for(const animation of ["v4-type-rise","v4-canvas-reveal","v4-yellow-swipe","v4-red-pop","v4-intro-fade","v4-rail-enter"])assert.match(css,new RegExp("@keyframes "+animation));
 assert.match(css,/prefers-reduced-motion:no-preference/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(css,/\.hero\[data-variant="v4"\]/);
 assert.doesNotMatch(css,/animation-iteration-count:\s*infinite|animation:\s*[^;}]*infinite/i);
  assert.match(html,/class="brand-mark" src="\.\/assets\/deliver-assets-mark\.png"/);
  assert.equal((html.match(/src="\.\/assets\/deliver-assets-mark\.png"/g)||[]).length,1,"Only visible header mark; footer uses text wordmark");
});
test("V4: la secuencia cotidiana es visible y el diagrama técnico no domina la página",()=>{
 assert.doesNotMatch(html,/v4-flow-board/);
 for(const label of ["PROVEEDORES","COMERCIOS","PERSONAS","OPERADORES LOGÍSTICOS"])assert.ok(html.includes("<h3>"+label+"</h3>"));
 assert.doesNotMatch(html,/<details class="v4-architecture-details">/);
 assert.doesNotMatch(html,/roles-geometry-(?:mobile-)?es\.svg/);
 assert.match(app,/event\.key==="Escape"/);
});
test("CSP desde headers reales y prototipo sin indexación",()=>{
 const headers=readFileSync(new URL("../_headers",import.meta.url),"utf8");
 assert.match(headers,/frame-ancestors 'none'/);
 assert.match(headers,/X-Frame-Options: DENY/);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
 assert.doesNotMatch(html,/<meta[^>]*frame-ancestors/i);
});
