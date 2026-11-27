import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
const root=new URL("../",import.meta.url);
const read=p=>readFileSync(new URL(p,root),"utf8");
const html=read("index.html"),css=read("styles-hero-photo.css"),motion=read("scripts/motion.js"),audit=read("scripts/browser-audit.mjs");

test("ANIM-02 approved real-world photo, 2 mirrors disclosure, official identity and commercial CTA",()=>{
 assert.match(html,/desset-hero-editorial-poster\.webp/);
 assert.match(html,/data-src="\.\/assets\/desset-hero-editorial\.mp4"/);
 assert.match(html,/Escena conceptual: personas, paquetes y arquitectura urbana/);
 assert.match(html,/Conoce nuestro propósito/);
 assert.match(html,/deliver-assets-mark\.png/);
 assert.match(readFileSync(new URL("../prime.html",import.meta.url),"utf8"),/Representación conceptual/);
 assert.doesNotMatch(html,/IDEAS EN ACCIÓN/);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
});
test("ANIM-02 filmed entrance stages typography and approved photographic frame just once",()=>{
 for(const name of ["anim02-enter","anim02-type","anim02-frame","anim02-focus","anim02-chapter","anim02-panel"])
  assert.match(css,new RegExp("@keyframes "+name+"\\{"));
 assert.match(css,/#inicio \.prime-photo-image\{animation:anim02-focus 2\.05s/);
 assert.match(css,/#inicio \.prime-photo-surface\{animation:anim02-frame 1\.35s/);
 assert.match(css,/clip-path:inset\(0 0 12% 0\)/);
 assert.match(css,/brightness\(\.86\) saturate\(\.94\)/);
 assert.doesNotMatch(css,/animation-iteration-count:\s*infinite|animation:\s*[^;}]*\binfinite\b/i);
 assert.doesNotMatch(css,/@import\b|url\(\s*['"]?https?:/i);
});
test("ANIM-02 chapters use progressive one-time observers without timers or auto WebGL",()=>{
 assert.match(motion,/\.solutions-grid \.service--main, \.business-pitch,/);
 assert.doesNotMatch(motion,/\.statement-side|\.section-head/);
 assert.match(motion,/instance\.unobserve\(entry\.target\)/);
 assert.match(motion,/root\.dataset\.anim02="cinematic-chapters"/);
 assert.match(motion,/root\.dataset\.motionDirection="editorial-cinematic-v1"/);
 assert.match(motion,/if\(reduced\|\|typeof window\.IntersectionObserver!=="function"\)/);
 assert.doesNotMatch(motion,/addEventListener\(["']scroll|setInterval|setTimeout|requestAnimationFrame|scrollTo|localStorage|fetch\s*\(/);
});
test("ANIM-02 checks actual browser animation and reduced-motion computed styles",()=>{
 assert.match(audit,/ANIM-02 real photographic opening, official mark, editorial chronology/);
 assert.match(audit,/anim02\.photo!=="none"/);
 assert.match(audit,/ANIM-02 reduced motion leaves approved image and copy static/);
 assert.match(audit,/anim02Reduced\.photo!=="none"/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{/);
 assert.match(css,/animation:none!important;transform:none!important;clip-path:none!important;/);
 assert.ok(statSync(new URL("styles-hero-photo.css",root)).size<=17000);
});
