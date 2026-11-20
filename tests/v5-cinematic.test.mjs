import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";

const root=new URL("../",import.meta.url);
const read=path=>readFileSync(new URL(path,root),"utf8");
const html=read("index.html");
const css=read("styles-v5.css");
const motion=read("scripts/v5-cinematic.js");
const svg=read("assets/v5-logistics-scene.svg");
const mobileSvg=read("assets/v5-logistics-mobile.svg");
const workflow=read(".github/workflows/preview-checks.yml");

test("V5 is an additive local layer with a reversible surface",()=>{
  assert.match(html,/href="\.\/styles\.css"/);
  assert.match(html,/href="\.\/styles-v5\.css"/);
  assert.match(html,/src="\.\/scripts\/motion\.js"/);
  assert.match(html,/src="\.\/scripts\/v5-cinematic\.js"/);
  assert.match(html,/src="\.\/assets\/v5-logistics-scene\.svg"/);
  assert.match(html,/srcset="\.\/assets\/v5-logistics-mobile\.svg"/);
  assert.match(html,/media="\(max-width: 430px\)"/);
  assert.ok(statSync(new URL("styles-v5.css",root)).size<16000);
  assert.ok(statSync(new URL("assets/v5-logistics-scene.svg",root)).size<18000);
  assert.ok(statSync(new URL("index.html",root)).size<35000);
  assert.doesNotMatch(html,/<video\b|<canvas\b|<iframe\b|<form\b/i);
  assert.doesNotMatch(html,/https?:\/\/[^\s"']+\.(?:js|css|mp4|webm)/i);
});

test("V5 renders three conceptual scenes without fabricating commerce",()=>{
  for(const id of ["inicio","ecosistema","contacto"])assert.match(html,new RegExp('id="'+id+'"'));
  assert.match(html,/v5-hero-refraction/);
  assert.match(html,/class="v5-city-stage"/);
  assert.match(html,/v5-contact-light/);
  assert.match(html,/Visualización conceptual del sistema previsto/);
  assert.match(html,/todavía no realiza pedidos ni entregas comerciales/);
  assert.match(html,/alt="Ilustración isométrica conceptual:/);
  assert.match(html,/v5-route-overlay[^>]+aria-hidden="true"/);
  assert.match(html,/deliver-assets-mark\.png/);
  assert.match(html,/ELEGIR/);assert.match(html,/ORGANIZAR/);assert.match(html,/MOVER/);
  assert.doesNotMatch(html,/tenemos [0-9]+ repartidores|entregas realizadas|cliente[s]? satisfechos/i);
});

test("V5 graphic is authored locally, without scripts or external imagery",()=>{
  assert.match(svg,/<svg\b/);
  assert.match(svg,/viewBox="0 0 1200 560"/);
  assert.match(svg,/<title id="title">/);
  assert.match(svg,/<desc id="desc">/);
  assert.match(svg,/id="shadow"/);
  assert.match(svg,/id="blueWall"/);
  assert.match(svg,/id="yellow"/);
  assert.match(svg,/id="red"/);
  assert.doesNotMatch(svg,/<script\b|<foreignObject\b|<image\b|xlink:href|href="https?:\/\//i);
  assert.match(mobileSvg,/viewBox="0 0 390 560"/);
  assert.match(mobileSvg,/comercio con toldo amarillo/);
  assert.match(mobileSvg,/recorrido amarillo luminoso/);
  assert.doesNotMatch(mobileSvg,/<script\b|<foreignObject\b|<image\b|xlink:href|href="https?:\/\//i);
  assert.ok(statSync(new URL("assets/v5-logistics-mobile.svg",root)).size<18000);
  assert.match(css,/@media\(max-width:430px\)\{[\s\S]*?\.v5-route-overlay \{display:none;\}/);
  assert.match(css,/\.v5-stage-world \{aspect-ratio:390 \/ 560;min-height:0;\}/);
});

test("V5 animations are finite and accessible; no scroll listener, tracking or blocking",()=>{
  for(const frame of ["v5-hero-light","v5-route-draw","v5-camera-arrive","v5-contact-arrive"]){
    assert.match(css,new RegExp("@keyframes "+frame+"\\s*\\{"));
  }
  assert.match(css,/@media\s*\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/\.v5-route-line\s*\{stroke-dasharray:11 12;stroke-dashoffset:0!important/);
  assert.match(motion,/const reduced=media\?\.matches===true/);
  assert.match(motion,/instance\.unobserve\(entry\.target\)/);
  assert.match(motion,/root\.dataset\.v5Mode="ready"/);
  assert.doesNotMatch(css,/animation\s*:[^;}]*\binfinite\b|animation-iteration-count\s*:\s*infinite/i);
  assert.doesNotMatch(motion,/addEventListener\(["']scroll|setInterval|setTimeout|fetch\s*\(|localStorage|sessionStorage|navigator\.sendBeacon|WebSocket|scrollTo/i);
  assert.doesNotMatch(motion,/innerHTML\s*=|eval\s*\(/);
});

test("V5 remains deliberately non-deployable in CI",()=>{
  assert.match(html,/<meta name="robots" content="noindex,nofollow">/);
  assert.match(workflow,/permissions:\s*\n\s*contents:\s*read/);
  assert.match(workflow,/No deployment mechanisms/);
  assert.doesNotMatch(workflow,/pages:\s*write|id-token:\s*write|^\s*deploy:\s*$/m);
});
