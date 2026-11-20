import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
import {createHash} from "node:crypto";

const root=new URL("../",import.meta.url);
const read=path=>readFileSync(new URL(path,root),"utf8");
const html=read("index.html");
const css=read("styles-v5.css");
const motion=read("scripts/v5-cinematic.js");
const svg=read("assets/v5-logistics-scene.svg");
const mobileSvg=read("assets/v5-logistics-mobile.svg");
const workflow=read(".github/workflows/preview-checks.yml");
const desktopWebP=readFileSync(new URL("assets/v5-cinematic-desktop.webp",root));
const mobileWebP=readFileSync(new URL("assets/v5-cinematic-mobile.webp",root));
const sha256=b=>createHash("sha256").update(b).digest("hex");

test("V5 is an additive local layer with a reversible surface",()=>{
  assert.match(html,/href="\.\/styles\.css"/);
  assert.match(html,/href="\.\/styles-v5\.css"/);
  assert.match(html,/src="\.\/scripts\/motion\.js"/);
  assert.match(html,/src="\.\/scripts\/v5-cinematic\.js"/);
  assert.match(html,/src="\.\/assets\/v5-logistics-scene\.svg"/);
  assert.match(html,/srcset="\.\/assets\/v5-logistics-mobile\.svg"/);
  assert.match(html,/srcset="\.\/assets\/v5-cinematic-desktop\.webp"/);
  assert.match(html,/srcset="\.\/assets\/v5-cinematic-mobile\.webp"/);
  assert.match(html,/type="image\/webp"/);
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
  assert.match(html,/alt="Escena conceptual tridimensional:/);
  assert.doesNotMatch(html,/class="v5-route-overlay"/);
  assert.match(html,/deliver-assets-mark\.png/);
  assert.match(html,/ELEGIR/);assert.match(html,/ORGANIZAR/);assert.match(html,/MOVER/);
  assert.doesNotMatch(html,/tenemos [0-9]+ repartidores|entregas realizadas|cliente[s]? satisfechos/i);
});

test("V5.2 high-fidelity render assets are authentic, optimized, immutable and fall back to original vector",()=>{
  assert.equal(desktopWebP.subarray(0,4).toString(),"RIFF");
  assert.equal(desktopWebP.subarray(8,12).toString(),"WEBP");
  assert.equal(mobileWebP.subarray(0,4).toString(),"RIFF");
  assert.equal(mobileWebP.subarray(8,12).toString(),"WEBP");
  assert.ok(desktopWebP.length<=220000,"Desktop asset exceeds 220 KB budget");
  assert.ok(mobileWebP.length<=270000,"Mobile asset exceeds 270 KB budget");
  assert.equal(sha256(desktopWebP),"474f755562617e230f864306d91ed641f96d3bcf58c7757618209c5dd584ec39");
  assert.equal(sha256(mobileWebP),"4acb78bf2e97f6ee3647cc8b54368d80d6cf5ee730ad1e976c8be77da7fcb5cc");
  assert.ok(html.includes('media="(max-width: 430px)" type="image/webp" srcset="./assets/v5-cinematic-mobile.webp"'));
  assert.ok(html.includes('media="(max-width: 430px)" type="image/svg+xml" srcset="./assets/v5-logistics-mobile.svg"'));
  assert.ok(html.includes('media="(min-width: 431px)" type="image/webp" srcset="./assets/v5-cinematic-desktop.webp"'));
  assert.ok(css.includes("margin:0;max-width:none;max-height:none;width:100%;height:100%;"),"Render must override legacy ecosystem image cap");
  assert.match(html,/loading="eager" fetchpriority="low"/);
  assert.match(html,/no una operación real/i);
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
  assert.match(css,/\.v5-stage-world \{aspect-ratio:2 \/ 3;min-height:0;\}/);
  assert.doesNotMatch(css,/\.v5-route-overlay|\.v5-route-line|\.v5-route-node/);
});

test("V5 animations are finite and accessible; no scroll listener, tracking or blocking",()=>{
  for(const frame of ["v5-hero-light","v5-camera-arrive","v52-edge-light","v5-contact-arrive"]){
    assert.match(css,new RegExp("@keyframes "+frame+"\\s*\\{"));
  }
  assert.match(css,/@media\s*\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\) \{\s*\.v5-hero-refraction/);
  assert.match(css,/\.v5-stage-render \{filter:none!important;transform:none!important;\}/);
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
