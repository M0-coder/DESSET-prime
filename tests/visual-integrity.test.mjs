import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");
const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");

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
test("mobile brand vocabulary is not cut by nowrap overflow",()=>{
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/\.v4-hero-rail\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/\.v4-hero-rail b\{display:none\}/);
 assert.match(html,/>COMERCIO<\/span>/);
 assert.match(html,/>CONEXIÓN<\/span>/);
 assert.match(html,/>LOGÍSTICA<\/span>/);
 assert.match(html,/>FUTURO<\/span>/);
});
test("technical diagrams and four roles are one opt-in view, not repeated clutter",()=>{
 const detail=html.match(/<details class="v4-architecture-details">([\s\S]*?)<\/details>/);
 assert.ok(detail,"Technical accordion must exist");
 assert.match(detail[1],/roles-geometry-v2.svg/);
 assert.match(detail[1],/class="roles" role="list"/);
 assert.equal((detail[1].match(/class="role" role="listitem"/g)||[]).length,4);
 assert.equal((html.match(/class="roles" role="list"/g)||[]).length,1);
 assert.match(css,/\.v4-architecture-details summary:focus-visible/);
});
