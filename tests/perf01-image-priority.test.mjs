import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const html=read("index.html"),audit=read("scripts/browser-audit.mjs");

test("PERF-01 preloads only the matching responsive approved hero ahead of CSS",()=>{
 const head=html.split("</head>")[0];
 const h=[...head.matchAll(/<link rel="preload" as="image" type="image\/webp" href="([^"]+)" media="([^"]+)" fetchpriority="high">/g)];
 assert.equal(h.length,2);
 assert.deepEqual(h.map(m=>[m[1],m[2]]),[
  ["./assets/desset-hero-entrega-mobile.webp","(max-width: 700px)"],
  ["./assets/desset-hero-entrega-dos-espejos.webp","(min-width: 701px)"]
 ]);
 assert.equal((head.match(/rel="preload"/g)||[]).length,2);
 assert.ok(head.indexOf('rel="preload"')<head.indexOf('rel="stylesheet"'));
 assert.match(html,/<source type="image\/webp" media="\(max-width: 700px\)" srcset="\.\/assets\/desset-hero-entrega-mobile\.webp">/);
 assert.match(html,/src="\.\/assets\/desset-hero-entrega-dos-espejos\.webp" width="1671" height="941"/);
 assert.match(html,/loading="eager" fetchpriority="high"/);
 assert.match(html,/class="v5-stage-render"[^>]*decoding="async" loading="lazy" fetchpriority="low"/);
});
test("PERF-01 three original photos remain lazy and are explicitly low-priority",()=>{
 for(const n of ["choose","prepare","move"]){
  assert.match(html,new RegExp('srcset="\\./assets/scene-'+n+'\\.webp"'));
  assert.match(html,new RegExp('src="\\./assets/scene-'+n+'\\.svg" width="320" height="220" alt="" decoding="async" loading="lazy" fetchpriority="low"'));
 }
 assert.equal((html.match(/loading="lazy" fetchpriority="low"/g)||[]).length,3);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
 assert.match(html,/Hablemos de tu negocio/);
 assert.match(html,/deliver-assets-mark\.png/);
 assert.doesNotMatch(html,/<video\b|<iframe\b|IDEAS EN ACCIÓN/);
});
test("PERF-01 checks browser-selected responsive preload and real effective priorities",()=>{
 assert.match(audit,/PERF-01 exact responsive hero preload and deferred triptych priority/);
 assert.match(audit,/matchMedia\(x\.media\)\.matches/);
 assert.match(audit,/perf01\.activeCount!==1/);
 assert.match(audit,/perf01\.heroPriority!=="high"/);
 assert.match(audit,/perf01\.offscreen3D\.loading!=="lazy"/);
 assert.match(audit,/perf01\.stories\.some\(x=>x\.loading!=="lazy"\|\|x\.priority!=="low"\)/);
});
