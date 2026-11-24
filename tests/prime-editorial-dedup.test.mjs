import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const read=(name)=>readFileSync(new URL("../"+name,import.meta.url),"utf8");
const html=read("index.html");
const css=["styles.css","styles-system.css","styles-hero-photo.css","styles-visual02.css"].map(read).join("\n");
const cinematic=read("scripts/v5-cinematic.js");
const motion=read("scripts/motion.js");

test("Seven redundant editorial blocks are removed from the actual HTML, not hidden",()=>{
  for(const phrase of [
    "Elegir, preparar<br>y entregar",
    "El funcionamiento del ecosistema se organiza en tres momentos",
    "Explorar recorrido 3D",
    "Comercio, tecnología y distribución se integran en una misma arquitectura",
    "UN ECOSISTEMA, TRES PILARES",
    "Pedidos, comercios<br>y última milla",
    "Servicios organizados alrededor de tres necesidades",
    "Este recorrido es conceptual y no representa una operación activa",
    "Para negocios<br>y aliados",
    "DESSET conecta una propuesta de servicios con las necesidades",
  ])assert.ok(!html.includes(phrase),"Removed editorial copy remains: "+phrase);
  for(const selector of ["statement-side","trust-ledger","section-head","ecosystem-footnote","hero-secondary"])
    assert.doesNotMatch(html,new RegExp('class="[^"]*\\b'+selector+'\\b'),"Removed block remains: "+selector);
  assert.doesNotMatch(html,/data-v64-tour-launch/);
});

test("Prime still has six uniquely named sections and working in-page links",()=>{
  const sections=[...html.matchAll(/<section\b[^>]*>/g)].map(m=>m[0]);
  assert.equal(sections.length,6);
  assert.equal((html.match(/<\/section>/g)||[]).length,6);
  for(const id of ["inicio","vision","soluciones","ecosistema","negocios","contacto"])
    assert.ok(sections.some(s=>s.includes('id="'+id+'"')),"Section missing: "+id);
  for(const id of ["soluciones","ecosistema","negocios"])
    assert.match(sections.find(s=>s.includes('id="'+id+'"')),/aria-label="[^"]+"/);
  const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]));
  for(const match of html.matchAll(/\bhref="#([^"]+)"/g))
    assert.ok(ids.has(match[1]),"Internal navigation target missing: #"+match[1]);
  for(const match of html.matchAll(/\baria-labelledby="([^"]+)"/g))
    for(const id of match[1].split(/\s+/))assert.ok(ids.has(id),"ARIA label missing: "+id);
});

test("Removal preserves real visual service, mobile imagery, GPU scene, honest app status, and official channels",()=>{
  for(const required of [
    'class="hero-cta"','class="business-pitch"',
    'class="v5-city-stage"','class="v6-three-mount"',
    'class="v63-tour"','class="v6-pause"',
    'ecosistema-proveedores.webp','ecosistema-comercios.webp','ecosistema-consumidores.webp','ecosistema-operadores-logisticos.webp',
  ])assert.ok(html.includes(required),"Functional element removed: "+required);
  assert.equal((html.match(/data-channel-basis="owner-attested"/g)||[]).length,5);
  assert.match(cinematic,/activationObserver\.observe\(stage\)/);
  assert.doesNotMatch(cinematic,/data-v64-tour-launch/);
  assert.doesNotMatch(motion,/\.section-head|\.statement-side/);
});

test("Dead styles were deleted rather than turned into display:none",()=>{
  for(const file of ["index.html","styles.css","styles-system.css","styles-hero-photo.css","styles-visual02.css"])
    assert.doesNotMatch(read(file),/\.(?:trust-ledger(?:-[\w-]+)?|statement-side|statement-symbol|text-cta|section-head|ecosystem-footnote|hero-secondary)\b/);
  assert.match(css,/\.statement-body\{display:grid;grid-template-columns:minmax\(0,1fr\)/);
  assert.doesNotMatch(css,/\.trust-ledger[^\n]*display:none/);
});

test("EDITORIAL-09 actually deletes the two marked desktop ornaments without hiding or breaking 3D",()=>{
 const removedMarkup=[
  "v4-hero-declaration",
  "v5-stage-caption",
  "motion-story-bridge",
  "EL COMERCIO CONECTADO",
  "Visualización conceptual del sistema previsto",
  "COMERCIO · TECNOLOGÍA · LOGÍSTICA",
 ];
 for(const token of removedMarkup)assert.ok(!html.includes(token),"Redundant UI must be removed from HTML: "+token);
 const stylesheetNames=["styles.css","styles-v5.css","styles-hero-photo.css","styles-system.css","styles-visual02.css"];
 for(const sheet of stylesheetNames){
  const cssSource=read(sheet);
  assert.doesNotMatch(cssSource,/\.v4-hero-declaration\b|\.v5-stage-caption\b|\.motion-story-bridge(?:-start|-line|-end)?\b/,
   "Do not retain or hide obsolete ornament CSS in "+sheet);
  assert.doesNotMatch(cssSource,/@keyframes (?:prime-bridge-draw|v45-declaration-in|v45-route-point)\b/);
 }
 assert.match(html,/<figure class="v5-city-stage" aria-label="Renderización gráfica conceptual de DESSET">/);
 assert.match(html,/class="v6-static-fallback"/);
 assert.match(html,/class="v6-three-mount"/);
 assert.match(html,/class="v63-tour"/);
 assert.equal((html.match(/class="motion-story-unit motion-story-unit--/g)||[]).length,4);
 assert.doesNotMatch(html,/prime-photo-caption|Representación conceptual · No corresponde a operaciones activas de DESSET/);
 assert.doesNotMatch(css,/\.prime-photo-caption/);
 assert.match(html,/aria-label="Escena conceptual:/);
 assert.doesNotMatch(html,/APLICACIONES DESSET|Acceso público no habilitado|data-service-access|data-app-links/);
 assert.equal((html.match(/data-channel-basis="owner-attested"/g)||[]).length,5);
});

test("CLEANUP-01 removes invisible hero ornaments physically, without touching visible brand or 3D",()=>{
 assert.doesNotMatch(html,/class="(?:v4-shape|v4-canvas-stamp|v5-hero-refraction|motion-brand-thread)/);
 assert.doesNotMatch(read("styles-hero-photo.css"),/\.prime-photo-surface \.v4-shape/);
 assert.equal((html.match(/src="\.\/assets\/deliver-assets-mark\.png"/g)||[]).length,1);
 assert.match(html,/class="prime-photo-image"/);
 assert.match(html,/class="v6-three-mount"/);
 assert.match(html,/class="v63-tour"/);
});
