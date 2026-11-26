import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const heroCss=readFileSync(new URL("../styles-hero-photo.css",import.meta.url),"utf8");

function luminance(hex){
 const chunks=hex.replace("#","").match(/.{2}/g).map(x=>parseInt(x,16)/255);
 const linear=chunks.map(n=>n<=0.04045?n/12.92:Math.pow((n+0.055)/1.055,2.4));
 return linear[0]*0.2126+linear[1]*0.7152+linear[2]*0.0722;
}
function ratio(foreground,background){
 const a=luminance(foreground),b=luminance(background);
 return (Math.max(a,b)+0.05)/(Math.min(a,b)+0.05);
}
function token(name){
 const m=css.match(new RegExp("--"+name+":(#[0-9a-fA-F]{6})"));
 assert.ok(m,"Missing color token "+name);
 return m[1];
}
test("small editorial red captions meet WCAG AA normal text on actual light backgrounds",()=>{
 const red=token("red-ink");
 for(const bg of [token("paper"),token("cream"),"#FFFFFF"]){
  assert.ok(ratio(red,bg)>=4.5,red+" on "+bg+" falls below 4.5:1");
 }
 assert.doesNotMatch(css,/\.section-head \.kicker/);
});
test("bright red stays an approved brand accent, while small text on red is dark",()=>{
 assert.equal(token("red").toUpperCase(),"#FF3328");
 assert.ok(ratio(token("ink"),token("red"))>=4.5);
 assert.doesNotMatch(css,/\.audiences \.audience:nth-child\(2\) \.audience-no/);
});
test("DESSET gold service rail has four substantive benefits and responsive geometry; approved high-contrast foreground",()=>{
 const rail=html.split('<div class="v4-hero-rail" role="list" aria-label="Áreas de servicios de DESSET">')[1]?.split("\n    </section>")[0]||"";
 assert.ok(rail.length>600,"Accessible service rail must exist in hero");
 assert.equal((rail.match(/class="v4-rail-item" role="listitem"/g)||[]).length,4);
 assert.equal((rail.match(/<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">/g)||[]).length,4);
 for(const [heading,copy] of [
  ["COMERCIO","Soluciones digitales para negocios y clientes."],
  ["CONEXIÓN","Tecnología para conectar y coordinar servicios."],
  ["LOGÍSTICA","Gestión de entregas y última milla."],
  ["DISTRIBUCIÓN","Paquetería, transporte y coordinación de cargas."]
 ])assert.ok(rail.includes('<strong>'+heading+'</strong><p>'+copy+'</p>'),heading+" exact approved description missing");
 assert.doesNotMatch(rail,/FUTURO|seguimiento en tiempo real|entregas activas/i);
 assert.match(heroCss,/#inicio \.v4-hero-rail\{display:grid;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(heroCss,/background:var\(--yellow\);color:#000;white-space:normal/);
 assert.match(heroCss,/@media\(max-width:860px\)\{#inicio \.v4-hero-rail\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(heroCss,/@media\(max-width:520px\)\{#inicio \.v4-rail-item\{display:block/);
 assert.ok(ratio("#222222","#FFC62F")>=4.5,"Gold strip body copy must meet WCAG AA text contrast");
 assert.ok(ratio("#000000","#FFC62F")>=4.5,"Gold strip headings must meet WCAG AA text contrast");
});
test("Obsolete technical accordion is removed from HTML, not hidden",()=>{
 assert.doesNotMatch(html,/v4-architecture-details|ecosystem-board v4-flow-board|class="roles" role="list"/);
 assert.match(html,/class="prime-service-cta" href="\.\/prime\.html"/);
 assert.match(heroCss,/#inicio \.v4-hero-rail\{[^\n]*background:var\(--yellow\);color:#000/);
 assert.match(heroCss,/#inicio \.v4-rail-item strong\{display:block;color:#000/);
 assert.match(heroCss,/#inicio \.v4-rail-item p\{margin:5px 0 0;color:#222/);
});

test("Homepage-only neutral palette retains approved brand colors and scope",()=>{
 assert.match(heroCss,/body:has\(#inicio\)\{--ds-60-surface:#fff\}/);
 assert.match(heroCss,/#empresa-destacada,#talento-destacado,#soluciones\.solutions,body:has\(#inicio\) \.site-footer\{background:#f5f5f5\}/);
 assert.match(heroCss,/#vision\.statement\[id="vision"\],#negocios\.audiences\{background:#fff\}/);
 assert.match(heroCss,/#inicio\.hero\[data-variant="v4"\]\{background:#f7f5ee/);
});

test("MOBILE-01 follows approved compact visual reference",()=>{
 const mobile=heroCss.split("/* MOBILE-01:")[1];
 assert.ok(mobile);
 assert.match(mobile,/@media\(max-width:700px\)/);
 assert.match(mobile,/@media\(min-width:320px\) and \(max-width:700px\)/);
 assert.match(mobile,/#inicio \.prime-photo-surface\{grid-row:3;/);
 assert.match(mobile,/#inicio \.hero-actions\{grid-row:4;/);
 assert.match(mobile,/#inicio \.hero-cta\{min-height:48px;/);
 assert.match(mobile,/#inicio \.v4-hero-rail\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(mobile,/#soluciones \.solutions-grid,#vision[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(html,/<nav class="mobile-footer" aria-label="Mapa del sitio móvil">/);
 assert.equal((html.match(/class="mobile-corporate-icon"/g)||[]).length,2);
});

test("MOBILE-PERF-01 removes critical hero compositing only at phone widths",()=>{
 const perf=heroCss.split("/* MOBILE-PERF-01:")[1]?.split("/* PHOTO-01:")[0];
 assert.ok(perf);
 assert.match(perf,/@media\(max-width:700px\)/);
 assert.match(perf,/#inicio \.prime-photo-surface,#inicio \.prime-photo-image\{/);
 assert.match(perf,/animation:none!important;transform:none!important;clip-path:none!important;/);
 assert.match(perf,/filter:none!important;opacity:1!important;will-change:auto/);
 assert.doesNotMatch(perf,/display:none|visibility:hidden|\.v6-|\.v5-city/);
 assert.match(heroCss,/#inicio \.prime-photo-image\{animation:anim02-focus 2\.05s/);
});

test("PHOTO-05: home talent photo is lazy, accessible and caption-free with mobile-first editorial crop",()=>{
 assert.match(html,/<img src="\.\/assets\/talento-equipo\.webp" width="1200" height="900" alt="[^"]+" loading="lazy" decoding="async" fetchpriority="low">/);
 assert.doesNotMatch(html.match(/<section class="institutional-home" id="talento-destacado"[\s\S]*?<\/section>/)[0],/<figcaption\b|Imagen referencial de colaboración profesional/);
 assert.match(heroCss,/\.talent-photo img\{[^}]*aspect-ratio:4\/3;object-fit:cover;object-position:50% 50%/);
 assert.match(heroCss,/\.talent-photo img\{aspect-ratio:16\/10;border-radius:9px\}/);
});
