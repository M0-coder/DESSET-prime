import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const html=read("index.html"),audit=read("scripts/browser-audit.mjs");

test("PERF-01 preserves the approved responsive hero and immediate visual fallback",()=>{
 assert.equal((html.match(/rel="preload"/g)||[]).length,0,"Discarded unproven preloads must not ship");
 assert.match(html,/<source type="image\/webp" media="\(max-width: 700px\)" srcset="\.\/assets\/desset-hero-entrega-mobile\.webp">/);
 assert.match(html,/src="\.\/assets\/desset-hero-entrega-dos-espejos\.webp" width="1671" height="941"/);
 assert.match(html,/class="prime-photo-image"[^>]*loading="eager" fetchpriority="high"/);
 assert.match(html,/class="v5-stage-render"[^>]*decoding="async" loading="eager" fetchpriority="low"/);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
});
test("PERF-01 three independently supplied photos load lazily with low priority",()=>{
 for(const n of ["choose","prepare","move"]){
  assert.match(html,new RegExp('srcset="\\./assets/scene-'+n+'\\.webp"'));
  assert.match(html,new RegExp('src="\\./assets/scene-'+n+'\\.svg" width="320" height="220" alt="" decoding="async" loading="lazy" fetchpriority="low"'));
 }
 assert.equal((html.match(/loading="lazy" fetchpriority="low"/g)||[]).length,3);
 assert.match(html,/Hablemos de tu negocio/);
 assert.match(html,/deliver-assets-mark\.png/);
 assert.doesNotMatch(html,/<video\b|<iframe\b|IDEAS EN ACCIÓN/);
});
test("PERF-01 browser regression proof protects poster fallback and priority",()=>{
 assert.match(audit,/PERF-01 correct hero, immediate 3D poster fallback and low-priority story photos/);
 assert.match(audit,/perf01\.preloads!==0/);
 assert.match(audit,/perf01\.posterLoading!=="eager"/);
 assert.match(audit,/perf01\.stories\.some\(x=>x\.loading!=="lazy"\|\|x\.priority!=="low"\)/);
});
