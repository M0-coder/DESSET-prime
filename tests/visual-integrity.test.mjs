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
test("DESSET blue service rail has four accessible, substantive benefits and responsive geometry",()=>{
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
 assert.match(heroCss,/background:#073bbc;color:#fff;white-space:normal/);
 assert.match(heroCss,/@media\(max-width:860px\)\{#inicio \.v4-hero-rail\{grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(heroCss,/@media\(max-width:520px\)\{#inicio \.v4-rail-item\{display:block/);
 assert.ok(ratio("#E2EBFF","#073BBC")>=4.5,"Small text must meet WCAG AA on brand blue");
 assert.ok(ratio("#FFFFFF","#073BBC")>=4.5,"Heading contrast must meet WCAG AA");
});
test("Obsolete technical accordion is removed from HTML, not hidden",()=>{
 assert.doesNotMatch(html,/v4-architecture-details|ecosystem-board v4-flow-board|class="roles" role="list"/);
 assert.match(html,/href="\.\/prime\.html#modelo"/);
 assert.match(heroCss,/#inicio \.v4-hero-rail\{[^\n]*background:var\(--yellow\);color:#000000/);
 assert.match(heroCss,/#inicio \.v4-rail-item strong\{display:block;color:#000000/);
 assert.match(heroCss,/#inicio \.v4-rail-item p\{margin:5px 0 0;color:#000000/);
});
