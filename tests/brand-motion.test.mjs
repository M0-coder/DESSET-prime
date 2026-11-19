import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
const head=html.split('<section id="inicio" class="hero hero--motion"')[1]?.split('<section class="statement"')[0]||"";
test("portada editorial sin reclamos de operación",()=>{
 assert.ok(head.length>800);
 assert.match(head,/COMERCIO/);assert.match(head,/LOGÍSTICA/);assert.match(head,/CONEXIÓN/);
 assert.match(head,/href="#soluciones"/);assert.match(head,/href="#negocios"/);
 assert.doesNotMatch(head,/Huacho|ciudad de|clientes activos|seguimiento en tiempo real|descarga la app/i);
});
test("animación tipográfica finita, sin bucles de movimiento y reducida accesible",()=>{
 assert.match(css,/@keyframes prime-type-in/);
 assert.match(css,/@keyframes prime-symbol-in/);
 assert.match(css,/prefers-reduced-motion:no-preference/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.doesNotMatch(css,/animation-iteration-count:\s*infinite|animation:\s*[^;}]*infinite/i);
});
test("CSP desde headers reales para frame-ancestors",()=>{
 const headers=readFileSync(new URL("../_headers",import.meta.url),"utf8");
 assert.match(headers,/frame-ancestors 'none'/);
 assert.match(headers,/X-Frame-Options: DENY/);
 assert.doesNotMatch(html,/<meta[^>]*frame-ancestors/i);
});
