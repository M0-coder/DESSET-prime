import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const root=new URL("../",import.meta.url);
const read=name=>readFileSync(new URL(name,root),"utf8");
const theme=read("styles-typography.css"),scene=read("styles-v5.css"),html=read("index.html");

function luminance(hex){
 const rgb=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255);
 const linear=rgb.map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 return linear[0]*.2126+linear[1]*.7152+linear[2]*.0722;
}
function contrast(a,b){
 const x=luminance(a),y=luminance(b);
 return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}
test("LIGHT-SURFACES-01 removes institutional charcoal backgrounds without changing brand surfaces",()=>{
 assert.match(theme,/#vision\.statement\{background:#f4f8fe;color:#000000\}/);
 assert.match(theme,/#ecosistema \.ecosystem-board\{background:#fff;/);
 assert.match(theme,/\.site-footer\{background:#fff;color:#000000;/);
 assert.match(theme,/\.main-nav \.nav-contact\{background:#fff;color:#073bbc;/);
 assert.match(theme,/#vision \.statement-journey \.motion-story-unit h3\{color:#000000\}/);
 assert.match(theme,/#vision \.statement-journey \.motion-story-unit p\{color:#363636\}/);
 assert.match(scene,/background:#f4f8fe; color:#162943;/);
 assert.match(scene,/z-index:7;background:#f4f8fe;color:#162943;/);
 assert.match(html,/<meta name="theme-color" content="#f4f8fe">/);
});
test("LIGHT-SURFACES-01 makes both 3D actions white and readable even when active",()=>{
 assert.match(scene,/background:#fff;color:#162943;/);
 assert.match(scene,/\.v6-three-controls \.v63-tour\{\s*background:#fff;color:#1551d8;/);
 assert.match(scene,/\.v6-three-controls button\[aria-pressed="true"\] \{border-color:#1551d8;background:#fff;color:#1551d8;/);
 assert.match(scene,/\.v63-story\{[\s\S]*?background:#fff;border:1px solid #c8d7ec;/);
 assert.match(scene,/color:#162943;background:#eff5ff;/);
});
test("LIGHT-SURFACES-01 preserves WCAG AA contrast for editorial text and 3D buttons",()=>{
 for(const [fg,bg] of [["#162943","#f4f8fe"],["#445a77","#f4f8fe"],["#1551d8","#ffffff"],["#162943","#ffffff"]])
  assert.ok(contrast(fg,bg)>=4.5,`${fg} on ${bg} contrast ${contrast(fg,bg).toFixed(2)}`);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
 assert.match(html,/class="v6-three-mount" aria-hidden="true"/);
});
