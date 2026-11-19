import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
const hero=source.split('<section class="hero hero--motion"')[1]?.split('<section class="statement"')[0]||"";
test("El hero original contiene solo copias del símbolo versionado, sin nuevos logos",()=>{
 assert.ok(hero.length>600);
 assert.equal((hero.match(/src="\.\/assets\/deliver-assets-mark\.png"/g)||[]).length,4);
 assert.doesNotMatch(hero,/<svg|data:image|background-image|https?:\/\//i);
});
test("La portada no atribuye operaciones, clientes ni cobertura inexistentes",()=>{
 for (const text of ["COMERCIO","LOGÍSTICA","MOVIMIENTO"]) assert.ok(hero.includes(text));
 assert.doesNotMatch(hero,/Huacho|ciudad de|seguimiento en tiempo real|pedidos confirmados|descarga la app|clientes activos/i);
});
test("Animación tipográfica y marca: duración finita, reducción de movimiento",()=>{
 assert.match(css,/@keyframes prime-type-in/);
 assert.match(css,/@keyframes prime-symbol-in/);
 assert.match(css,/prefers-reduced-motion:no-preference/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.doesNotMatch(css,/animation-iteration-count:\s*infinite|animation:\s*[^;}]*infinite/i);
});
test("Se conserva CSP, noindex y la hoja de movimiento está enlazada",()=>{
 assert.match(source,/href="\.\/styles-motion-v2\.css"/);
 assert.match(source,/name="robots" content="noindex,nofollow"/);
 assert.match(source,/Content-Security-Policy/);
});

const headers=readFileSync(new URL("../_headers",import.meta.url),"utf8");
test("Cabeceras y seguridad configuradas sin directivas CSP inválidas en meta",()=>{
 assert.match(headers,/frame-ancestors 'none'/);
 assert.match(headers,/X-Frame-Options: DENY/);
 assert.doesNotMatch(source,/<meta[^>]*frame-ancestors/i);
});
test("Sin segunda portada ni animaciones V1 superpuestas",()=>{
 assert.doesNotMatch(css,/@keyframes arrive|\.art-center\{|\.hero-art\{/);
 assert.doesNotMatch(source,/styles-motion-v2\.css/);
});
test("PNG original no se reescala por encima de 96 píxeles",()=>{
 assert.match(css,/\.hero--motion \.hero-symbol\{[^}]*width:96px/);
 assert.match(css,/\.hero--motion \.hero-symbol\{width:96px;max-width:none\}/);
});
