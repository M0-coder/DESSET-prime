import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const root=new URL("../",import.meta.url);
const html=readFileSync(new URL("index.html",root),"utf8");
const css=readFileSync(new URL("styles.css",root),"utf8");
const script=readFileSync(new URL("scripts/motion.js",root),"utf8");
const photoCss=readFileSync(new URL("styles-hero-photo.css",root),"utf8");

test("V4.5 retains exactly three cinematic beats around truthful current content",()=>{
 for(const id of ["inicio","ecosistema","contacto"])assert.match(html,new RegExp('id="'+id+'"'));
 for(const word of ["AUMENTA EL VALOR","A TU TIEMPO","PROVEEDORES","COMERCIOS","PERSONAS","OPERADORES LOGÍSTICOS","LAS BUENAS","CONEXIONES"])assert.ok(html.includes(word));
 assert.match(html,/no representa una operación activa/i);
 assert.doesNotMatch(html,/APLICACIONES DESSET|Acceso público no habilitado|data-service-access|data-app-links/);
 assert.match(html,/Esta web no procesa transacciones\./);
 assert.doesNotMatch(html,/\b0[1-9]\s*\/\s*[^<]+/);
});

test("V4.5 uses native finite keyframes for original geometry and original SVG scene illustrations",()=>{
 const frames=["v45-blue-strike","v45-mark-lock","v45-scene-illustration","v45-editorial-rise","v45-closing-reveal","v45-underline","v45-contact-slash"];
 for(const name of frames)assert.match(css,new RegExp("@keyframes "+name+"\\{"),"Missing movement "+name);
 assert.match(css,/\.motion-story-unit--choose\.motion-active \.motion-story-art img\{animation-delay:\.05s\}/);
 assert.match(css,/\.motion-story-unit--organize\.motion-active \.motion-story-art img\{animation-delay:\.16s\}/);
 assert.match(css,/\.motion-story-unit--move\.motion-active \.motion-story-art img\{animation-delay:\.27s\}/);
 for(const photo of ["ecosistema-proveedores","ecosistema-comercios","ecosistema-consumidores","ecosistema-operadores-logisticos"])assert.ok(html.includes("assets/"+photo+".webp"));
 assert.match(css,/ECOSYSTEM-PARTICIPANTS-01/);
 assert.match(html,/class="brand-mark" src="\.\/assets\/deliver-assets-mark\.png"/);
 assert.doesNotMatch(css,/animation-iteration-count\s*:\s*infinite|animation\s*:[^;}]*\binfinite\b/i);
});

test("V4.5 chooses IntersectionObserver once, never drives scroll positions, and offers static/reduced fallback",()=>{
 assert.match(script,/root\.dataset\.kineticVersion="v45"/);
 assert.match(script,/\.contact, \.closing-line/);
 assert.match(script,/instance\.unobserve\(entry\.target\)/);
 assert.match(script,/if\(reduced\|\|typeof window\.IntersectionObserver!=="function"\)/);
 assert.match(photoCss,/@media\(prefers-reduced-motion:no-preference\)/);
 assert.match(photoCss,/@media\(prefers-reduced-motion:reduce\)/);
 assert.doesNotMatch(script,/addEventListener\(["']scroll|setInterval|setTimeout|requestAnimationFrame|scrollTo|localStorage|fetch\s*\(/);
 assert.doesNotMatch(html,/<video\b|<canvas\b|<iframe\b|<form\b/i);
});

test("V4.5 enlarges typography while keeping narrow-phone and semantic link fallbacks",()=>{
 assert.match(css,/@media\(min-width:1181px\)\{[\s\S]*?font-size:clamp\(65px,8\.05vw,143px\)/);
 assert.match(css,/@media\(max-width:360px\)\{[\s\S]*?font-size:38px/);
 assert.match(html,/<a class="hero-cta" href="#contacto">/);
 assert.match(html,/Instagram<\/a>/);
 assert.match(html,/TikTok<\/a>/);
 assert.match(html,/YouTube<\/a>/);
 assert.match(html,/data-channel-review="owner-attested" data-channel-basis="owner-attested"/);
 assert.doesNotMatch(html,/clientes activos|entregas en tiempo real|garantizamos la entrega/i);
});
