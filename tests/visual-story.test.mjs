import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const root=new URL("../",import.meta.url);
const html=readFileSync(new URL("index.html",root),"utf8");
const css=readFileSync(new URL("styles.css",root),"utf8");
const src=readFileSync(new URL("scripts/motion.js",root),"utf8");

function runMotion(reduce=false,support=true){
 const observed=[],unobserved=[],targets=Array.from({length:3},()=>({
  classes:new Set(),
  classList:{add(name){this.target.classes.add(name)}}
 }));
 targets.forEach(x=>x.classList.target=x);
 let cb;
 class Observer{
  constructor(onChange,options){cb=onChange;this.options=options}
  observe(el){observed.push(el)}
  unobserve(el){unobserved.push(el)}
 }
 const document={documentElement:{dataset:{}},querySelectorAll:()=>targets};
 const window={matchMedia:()=>({matches:reduce})};
 if(support)window.IntersectionObserver=Observer;
 runInNewContext(src,{document,window},{timeout:1000});
 return {document,targets,observed,unobserved,activate(){
  if(!cb)return;
  const h={unobserve(el){unobserved.push(el)}};
  cb(targets.map(target=>({target,isIntersecting:true})),h);
 }};
}

test("motion system is progressive and never hides static content",()=>{
 const noObserver=runMotion(false,false);
 assert.equal(noObserver.document.documentElement.dataset.motionSystem,"static");
 assert.equal(noObserver.observed.length,0);
 const reduced=runMotion(true,true);
 assert.equal(reduced.document.documentElement.dataset.motionSystem,"reduced");
 assert.equal(reduced.observed.length,0);
});
test("intersection cues animate only once and unobserve",()=>{
 const flow=runMotion(false,true);
 assert.equal(flow.document.documentElement.dataset.motionSystem,"ready");
 assert.equal(flow.observed.length,3);
 flow.activate();
 assert.equal(flow.unobserved.length,3);
 assert.ok(flow.targets.every(t=>t.classes.has("motion-active")));
});
test("visual narrative uses original geometry grammar but makes no operational claim",()=>{
 assert.equal((html.match(/class="motion-story-unit motion-story-unit--/g)||[]).length,3);
 for(const label of ["ELEGIR","ORGANIZAR","MOVER"])assert.match(html,new RegExp("<h3>"+label));
 assert.match(html,/no representa una operación activa/i);
 assert.match(html,/class="motion-brand-thread"/);
 assert.match(html,/class="closing-title"/);
 assert.equal((html.match(/class="closing-line/g)||[]).length,3);
 assert.match(html,/src="\.\/scripts\/motion\.js"/);
 assert.equal((html.match(/roles-geometry-v2.svg/g)||[]).length,1);
 assert.equal((html.match(/src="\.\/assets\/deliver-assets-mark\.png"/g)||[]).length,3);
});
test("motion is finite, reduced-accessible and never depends on external services",()=>{
 for(const key of ["prime-thread-paint","prime-scene-rise","prime-bridge-draw","prime-shape-in","prime-type-line"]){
  assert.match(css,new RegExp("@keyframes "+key));
 }
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.doesNotMatch(css,/animation-iteration-count:\s*infinite|animation:\s*[^;}]*infinite/i);
 assert.doesNotMatch(src,/fetch\s*\(|setInterval\s*\(|setTimeout\s*\(|scrollTo\s*\(|localStorage|document\.write/);
});
