import test from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";import vm from "node:vm";
const source=readFileSync(new URL("../scripts/app.js",import.meta.url),"utf8");
function fixture({reduce=false,hidden=false}={}){
 const media={matches:reduce,addEventListener(n,fn){this.change=fn;}},events={},document={hidden,querySelector:()=>null,querySelectorAll:()=>[video],addEventListener(n,fn){events[n]=fn;}};
 let observer,plays=0,pauses=0,loads=0;
 const video={dataset:{src:"./assets/servicio-desset.mp4"},muted:false,loop:false,getAttribute(n){return n==="src"?this.src:null;},set src(v){this.url=v;loads++;},get src(){return this.url;},play(){plays++;return Promise.resolve();},pause(){pauses++;}};
 const window={matchMedia:()=>media,IntersectionObserver:class{constructor(fn){observer=fn;}observe(){}},setTimeout(){throw Error("Unexpected playback timeout");}};
 vm.runInNewContext(source,{window,document});
 return {video,media,document,events,enter:()=>observer([{isIntersecting:true}]),leave:()=>observer([{isIntersecting:false}]),counts:()=>({plays,pauses,loads})};
}
test("VIDEO-03 loads only in view, native loop enabled, no time limit",()=>{const f=fixture();assert.equal(f.video.src,undefined);f.enter();assert.deepEqual(f.counts(),{plays:1,pauses:0,loads:1});assert.equal(f.video.loop,true);assert.equal(f.video.muted,true);});
test("VIDEO-03 reduced motion and hidden tab do not trigger autoplay",()=>{for(const options of [{reduce:true},{hidden:true}]){const f=fixture(options);f.enter();assert.equal(f.counts().plays,0);assert.equal(f.video.src,undefined);}});
test("VIDEO-03 pauses outside viewport or on hidden tab / reduced motion, resumes without reloading",()=>{for(const [stop,resume] of [[f=>f.leave(),f=>f.enter()],[f=>{f.media.matches=true;f.media.change();},f=>{f.media.matches=false;f.media.change();}],[f=>{f.document.hidden=true;f.events.visibilitychange();},f=>{f.document.hidden=false;f.events.visibilitychange();}]]){const f=fixture();f.enter();stop(f);assert.equal(f.counts().pauses,1);resume(f);assert.deepEqual(f.counts(),{plays:2,pauses:1,loads:1});}});
