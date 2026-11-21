import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
const root=new URL("../",import.meta.url),read=p=>readFileSync(new URL(p,root),"utf8");
const css=read("styles.css"),system=read("styles-system.css"),motion=read("scripts/motion.js"),
 cinematic=read("scripts/v5-cinematic.js"),browser=read("scripts/browser-audit.mjs"),html=read("index.html");
test("ANIM-01 original hero, corporate CTA, logo and 3D semantics preserved",()=>{
 assert.match(html,/<a class="hero-cta" href="#contacto">Hablemos de tu negocio/);
 assert.match(html,/EL COMERCIO/);assert.match(html,/SE MUEVE/);
 assert.doesNotMatch(html,/data-v64-tour-launch/);assert.match(html,/class="v6-three-mount"/);assert.match(html,/class="v63-tour"/);assert.match(html,/assets\/deliver-assets-mark\.png/);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
});
test("ANIM-01 removes arcade scan, glint and pointer-driven lens",()=>{
 assert.match(css,/ANIM-01: game-like scan\/glint suppressed/);
 assert.match(css,/\.v5-hero-refraction \.v5-glint,\.v5-city-stage \.v5-stage-scan\{display:none\}/);
 assert.match(css,/\.v5-hero-refraction\{transform:none!important;transition:none!important\}/);
 assert.doesNotMatch(cinematic,/pointermove|pointerleave|requestAnimationFrame/);
 assert.match(cinematic,/ANIM-01: decorative lens stays still/);
 assert.match(css,/@keyframes v4-red-pop\{from\{transform:translate\(7%,6%\) rotate\(27deg\) scale\(\.97\)/);
 assert.match(css,/@keyframes v4-canvas-reveal\{from\{opacity:\.85;transform:translateY\(12px\)/);
});
test("ANIM-01 sequences real sections one time without hiding content or risking trust block",()=>{
 for(const sel of [".solutions-grid .service--main",".business-pitch",".audience-grid--compact .audience",".contact-bottom--rc"])
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
 assert.match(browser,/anim01\.glint!=="none"/);
 assert.match(browser,/anim01\.scan!=="none"/);
 assert.match(browser,/anim01\.red!=="v4-red-pop"/);
 assert.ok(statSync(new URL("styles.css",root)).size<45000);
 assert.ok(statSync(new URL("styles-system.css",root)).size<=9000);
});
