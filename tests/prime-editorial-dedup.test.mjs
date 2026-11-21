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
    'class="hero-cta"','class="business-pitch"','class="service-access"',
    'class="v5-city-stage"','class="v6-three-mount"',
    'class="v63-tour"','class="v6-pause"',
    'scene-choose.webp','scene-prepare.webp','scene-move.webp',
    'v5-cinematic-desktop.webp','v5-cinematic-mobile.webp',
    'data-service-access','data-app-links hidden',
    'DESSET todavía no realiza pedidos ni entregas comerciales',
  ])assert.ok(html.includes(required),"Functional element removed: "+required);
  assert.equal((html.match(/data-channel-basis="owner-attested"/g)||[]).length,3);
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
