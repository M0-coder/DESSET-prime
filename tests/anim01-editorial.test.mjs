import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
const root=new URL("../",import.meta.url),read=p=>readFileSync(new URL(p,root),"utf8");
const css=read("styles.css"),system=read("styles-system.css"),motion=read("scripts/motion.js"),
 cinematic=read("scripts/v5-cinematic.js"),browser=read("scripts/browser-audit.mjs"),html=read("index.html"),photoCss=read("styles-hero-photo.css");
test("ANIM-01 original hero, corporate CTA, logo and 3D semantics preserved",()=>{
 assert.match(html,/<a class="hero-cta" href="\.\/mision-vision-valores\.html#proposito">Conoce nuestro propósito/);
 assert.match(html,/class="motion-line v4-headline-a"><span class="motion-line__inner">AUMENTA EL VALOR<\/span>/);assert.match(html,/class="motion-line v4-headline-b"><span class="motion-line__inner">A TU TIEMPO<\/span>/);
 assert.doesNotMatch(html,/data-v64-tour-launch/);assert.match(readFileSync(new URL("../prime.html",import.meta.url),"utf8"),/class="v6-three-mount"/);assert.match(readFileSync(new URL("../prime.html",import.meta.url),"utf8"),/class="v63-tour"/);assert.match(html,/assets\/deliver-assets-mark\.png/);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
});
test("ANIM-01 removes arcade scan, glint and pointer-driven lens",()=>{
 assert.match(css,/ANIM-01: game-like scan\/glint suppressed/);
  assert.doesNotMatch(css,/\.v5-city-stage \.v5-stage-scan/);
  assert.doesNotMatch(html,/v5-hero-refraction|v5-glint|class="v4-shape|motion-brand-thread/);
 assert.doesNotMatch(cinematic,/pointermove|pointerleave|requestAnimationFrame/);
  assert.match(cinematic,/ANIM-01: viewport-activated 3D remains independent of cursor-following ornaments/);
  assert.match(css,/@keyframes v45-editorial-rise/);
  assert.match(photoCss,/@keyframes anim02-frame/);
});
test("ANIM-01 sequences real sections one time without hiding content or risking trust block",()=>{
 for(const sel of [".solutions-grid .service--main",".business-pitch",".audience-grid--compact .audience"])
  assert.ok(motion.includes(sel));
 assert.doesNotMatch(motion,/\.trust-ledger/);
 assert.match(motion,/root\.dataset\.motionDirection="editorial-cinematic-v1"/);
 assert.match(motion,/instance\.unobserve\(entry\.target\)/);
 assert.match(motion,/if\(reduced\|\|typeof window\.IntersectionObserver!=="function"\)/);
 assert.match(system,/from \{opacity:1;transform:translate3d\(0,15px,0\);\}/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.doesNotMatch(motion,/addEventListener\(["']scroll|setInterval|setTimeout|requestAnimationFrame|scrollTo|localStorage|fetch\s*\(/);
});
test("ANIM-01 browser style proof and strict legacy payload budgets",()=>{
 assert.match(browser,/ANIM-01 no scanner, glint, cursor-game lens or bouncing hero/);
  assert.match(browser,/!anim01\.noScan/);
  assert.match(browser,/!anim01\.noDecor/);
  assert.match(browser,/anim01\.direction!=="editorial-cinematic-v1"/);
 assert.ok(statSync(new URL("styles.css",root)).size<45000);
 assert.ok(statSync(new URL("styles-system.css",root)).size<=14000);
});
