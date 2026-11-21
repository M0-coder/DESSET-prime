import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const root=new URL("../",import.meta.url);
const html=readFileSync(new URL("index.html",root),"utf8");
const css=readFileSync(new URL("styles.css",root),"utf8");

const obsoleteLabels=[
 "header-descriptor","v4-hero-caption","v4-edition","v4-signal",
 "hero-kicker","hero-kicker-line","v4-canvas-top","v4-canvas-bottom",
 "hero-meta","section-label","kicker","service-top","status",
 "status--initial","ecosystem-board-top","motion-story-index",
 "motion-story-status","audience-no","audience-tag","business-pitch-top",
 "closing-kicker-signal"
];

test("no numbered editorial label survives in any visible section, card, diagram or hero",()=>{
 assert.doesNotMatch(html,/\b0[1-9]\s*\/\s*[^<]+/,"Editorial section numbers must be absent");
 assert.doesNotMatch(html,/CONEXIÓN\s*\/\s*001|IDENTIDAD EN MOVIMIENTO\s*[—-]\s*01/i);
 for(const label of obsoleteLabels){
  const activeClasses=[...html.matchAll(/class="([^"]+)"/g)].flatMap(m=>m[1].split(/\s+/));
  assert.ok(!activeClasses.includes(label),"Obsolete caption remains: "+label);
  assert.doesNotMatch(css,new RegExp('\\.'+label+'(?![\\w-])'),"Unused caption selector remains: "+label);
 }
 assert.doesNotMatch(html,/<div class="role" role="listitem"><span>/,"Technical architecture roles need no numeric index");
 assert.doesNotMatch(html,/<div class="trust-ledger-item"><span>/,"Trust messages need no numeric index");
});

test("primary business narrative remains intelligible without decorative microcopy",()=>{
 for(const heading of ["EL COMERCIO","SE MUEVE","NO ES SOLO","Pedidos y","¿TU NEGOCIO","ELEGIR","PREPARAR","ENTREGAR","LAS BUENAS"]){
  assert.ok(html.includes(heading),"Missing principal heading: "+heading);
 }
 assert.equal((html.match(/class="motion-story-unit motion-story-unit--/g)||[]).length,3);
 assert.doesNotMatch(html,/class="trust-ledger"/);
 assert.equal((html.match(/class="role" role="listitem"/g)||[]).length,4);
 assert.match(html,/Un modelo integrado para solicitudes de clientes/);
 assert.match(html,/Área complementaria del modelo logístico/);
 assert.match(html,/Representación conceptual · No corresponde a operaciones activas de DESSET/i);
 assert.match(html,/Acceso público no habilitado/);
 assert.match(html,/Este sitio no procesa pedidos ni pagos/);
});

test("numbered captions do not return in responsive or reduced-motion styling",()=>{
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/\.motion-story-unit h3\{grid-column:1;grid-row:2;/);
 assert.match(css,/\.motion-story-unit p\{grid-column:1;grid-row:3;/);
 assert.match(css,/\.v4-architecture-details summary:focus-visible/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.doesNotMatch(html,/href="#"/);
});
