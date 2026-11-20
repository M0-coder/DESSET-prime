import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const css=read("styles.css"),motion=read("scripts/motion.js"),browser=read("scripts/browser-audit.mjs"),html=read("index.html");
test("ANIM-01 preserves preferred hero, copy, CTA, logo and 3D engine untouched",()=>{
 assert.match(html,/<a class="hero-cta" href="#contacto">Hablemos de tu negocio/);
 assert.match(html,/EL COMERCIO/);
 assert.match(html,/SE MUEVE/);
 assert.match(html,/data-v64-tour-launch/);
 assert.match(html,/assets\/deliver-assets-mark\.png/);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
});
test("ANIM-01 ends game-like scanner, glint and cursor chasing with editorial transitions",()=>{
 assert.match(css,/ANIM-01 — cinematic editorial direction/);
 assert.match(css,/\.v5-hero-refraction \.v5-glint,\s*\.v5-city-stage \.v5-stage-scan \{display:none;\}/);
 assert.match(css,/\.v5-hero-refraction\{transform:none!important;transition:none!important;\}/);
 for(const key of ["anim01-graphic-settle","anim01-editorial-entrance","anim01-closing-line"])
  assert.match(css,new RegExp("@keyframes "+key+"\\{"));
 assert.match(css,/\.contact \.closing-line\.motion-active\{animation:anim01-closing-line/);
 assert.doesNotMatch(css,/animation-iteration-count:\s*infinite|animation:\s*[^;}]*\binfinite\b/i);
});
test("ANIM-01 broadens one-shot editorial cues without hiding source content",()=>{
 for(const key of [".trust-ledger",".solutions-grid .service--main",".business-pitch",".audience-grid--compact .audience",".contact-bottom--rc"])
  assert.ok(motion.includes(key),"Missing observer cue "+key);
 assert.match(motion,/instance\.unobserve\(entry\.target\)/);
 assert.match(motion,/if\(reduced\|\|typeof window\.IntersectionObserver!=="function"\)/);
 assert.match(motion,/root\.dataset\.motionDirection="editorial-cinematic-v1"/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{\s*\.v5-hero-refraction/);
 assert.match(css,/\.trust-ledger,\.solutions-grid \.service--main,\.business-pitch,/);
 assert.doesNotMatch(motion,/addEventListener\(["']scroll|setInterval|setTimeout|requestAnimationFrame|scrollTo|localStorage|fetch\s*\(/);
});
test("ANIM-01 verifies computed styles in browser against real HTML",()=>{
 assert.match(browser,/ANIM-01 no scanner, glint, cursor-game lens or bouncing hero/);
 assert.match(browser,/anim01\.glint!=="none"/);
 assert.match(browser,/anim01\.scan!=="none"/);
 assert.match(browser,/anim01\.red!=="anim01-graphic-settle"/);
});
