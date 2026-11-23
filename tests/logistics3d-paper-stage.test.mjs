import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const root=new URL("../",import.meta.url);
const read=path=>readFileSync(new URL(path,root),"utf8");
const css=read("styles-v5.css");
const scene=read("scripts/v6-three.src.mjs");
const launcher=read("scripts/v5-cinematic.js");

test("LOGISTICS-PAPER-01: desktop and mobile share the same pale WebGL canvas and accessible fallback",()=>{
 assert.match(scene,/night:0xf4f8fe/);
 assert.match(scene,/scene\.background=new THREE\.Color\(PAL\.night\)/);
 assert.match(scene,/renderer\.setClearColor\(PAL\.night,1\)/);
 assert.match(css,/\.v5-stage-world \{[^\n]*background:#f4f8fe;/);
 assert.match(css,/\.v6-static-fallback\{[^\n]*#f4f8fe;color:#162943/);
 assert.match(css,/\.v6-three-mount \{[^}]*background:#f4f8fe/);
 assert.match(css,/\.v6-static-fallback__note\{[^\n]*color:#445a77/);
});

test("LOGISTICS-PAPER-01: open desktop framing while keeping the proven mobile fit",()=>{
 assert.match(scene,/overview:\{pos:\[12,13\.5,19\.5\],look:\[0,1,0\]\}/);
 assert.match(scene,/const ratio=w\/Math\.max\(1,h\),size=vertical\?8\.0:coarse\?6\.35:6\.55;/);
 assert.match(scene,/const vertical=window\.matchMedia\?\.\("\(max-width: 430px\)"\)/);
 assert.match(scene,/hydrateGLBModels\(/);
 assert.match(css,/\.v5-city-stage\[data-v6-state="active"\] \.logistics-hud\{opacity:1;visibility:visible\}/);
 assert.match(css,/\.logistics-hud__card--docks/);
 assert.match(css,/\.logistics-hud__card--notice/);
});

test("LOGISTICS-PAPER-01: refresh scene bundle without changing release or service semantics",()=>{
 assert.match(launcher,/script\.src="\.\/assets\/v6-three\.bundle\.js\?scene=paper-v1"/);
 assert.match(launcher,/activationObserver\.observe\(stage\)/);
 assert.match(launcher,/stage\.addEventListener\("desset:v6-ready"/);
 assert.doesNotMatch(launcher,/\bfetch\s*\(/);
 const html=read("index.html");
 assert.match(html,/name="robots" content="noindex,nofollow"/);
 assert.match(html,/No corresponde a pedidos ni entregas activas/);
});
