import test from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";import vm from "node:vm";
const source=readFileSync(new URL("../scripts/app.js",import.meta.url),"utf8");
function fixture({reduce=false,hidden=false}={}){
 const media={matches:reduce,addEventListener(n,fn){this.change=fn;}},events={},document={hidden,querySelector:()=>null,querySelectorAll:()=>[video],addEventListener(n,fn){events[n]=fn;}};
 let observer,timer,ms,plays=0,pauses=0;const handlers={};
 const video={dataset:{src:"./assets/servicio-desset.mp4"},muted:false,loop:true,addEventListener(n,fn){handlers[n]=fn;},play(){plays++;return Promise.resolve();},pause(){pauses++;}};
 const window={matchMedia:()=>media,IntersectionObserver:class{constructor(fn){observer=fn;}observe(){}disconnect(){}},setTimeout(fn,t){timer=fn;ms=t;return 1;},clearTimeout(){}};
 vm.runInNewContext(source,{window,document});
 return {video,media,document,events,handlers,enter:()=>observer([{isIntersecting:true}]),leave:()=>observer([{isIntersecting:false}]),expire:()=>timer(),counts:()=>({plays,pauses,ms})};
}
test("VIDEO-02 loads only in view, never loops, stops within 4.8 seconds and never restarts",()=>{const f=fixture();assert.equal(f.video.src,undefined);f.enter();assert.deepEqual(f.counts(),{plays:1,pauses:0,ms:4800});assert.equal(f.video.loop,false);assert.equal(f.video.muted,true);f.expire();f.enter();assert.equal(f.counts().plays,1);assert.equal(f.counts().pauses,1);});
test("VIDEO-02 reduced motion and hidden tab do not trigger autoplay",()=>{for(const options of [{reduce:true},{hidden:true}]){const f=fixture(options);f.enter();assert.equal(f.counts().plays,0);assert.equal(f.video.src,undefined);}});
test("VIDEO-02 exiting viewport or switching motion preference stops preview permanently",()=>{for(const stop of [f=>f.leave(),f=>{f.media.matches=true;f.media.change();},f=>{f.document.hidden=true;f.events.visibilitychange();},f=>f.handlers.ended()]){const f=fixture();f.enter();stop(f);f.enter();assert.equal(f.counts().plays,1);assert.equal(f.counts().pauses,1);}});
