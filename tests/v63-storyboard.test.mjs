import test from "node:test";
import assert from "node:assert/strict";
import {STORY_BEATS,STORY_DURATION,storyAtTime,routeProgress} from "../scripts/v63-storyboard.mjs";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const read=p=>readFileSync(new URL(p,root),"utf8");
test("V6.3 five conceptual scenes form a deterministic, contiguous, finite route",()=>{
 assert.equal(STORY_BEATS.length,5);
 assert.deepEqual(STORY_BEATS.map(x=>x.view),["overview","commerce","courier","destination","overview"]);
 assert.ok(STORY_DURATION>9&&STORY_DURATION<12);
 assert.equal(STORY_BEATS[0].start,0);
 assert.equal(STORY_BEATS.at(-1).end,STORY_DURATION);
 for(let i=0;i<STORY_BEATS.length;i++){
  const beat=STORY_BEATS[i];
  assert.ok(beat.end>beat.start);
  assert.ok(beat.title.length>=5&&beat.detail.length>=10);
  if(i)assert.equal(STORY_BEATS[i-1].end,beat.start);
  assert.equal(storyAtTime((beat.start+beat.end)/2).beat.id,beat.id);
 }
});
test("V6.3 choreography clamps negative and oversized timestamps and reaches 100%",()=>{
 assert.equal(storyAtTime(-99).index,0);
 assert.equal(storyAtTime(-99).progress,0);
 assert.equal(storyAtTime(STORY_DURATION).done,true);
 assert.equal(storyAtTime(STORY_DURATION).progress,100);
 assert.equal(storyAtTime(999).seconds,STORY_DURATION);
 for(const value of [NaN,Infinity,-Infinity,"3",null])assert.throws(()=>storyAtTime(value),TypeError);
 for(let n=0;n<=200;n++){
  const t=STORY_DURATION*n/200;
  const current=storyAtTime(t);
  assert.ok(current.index>=0&&current.index<STORY_BEATS.length);
  assert.ok(current.progress>=0&&current.progress<=100);
 }
});
test("V6.3 smooth route motion is monotonic, bounded and independent of FPS",()=>{
 assert.equal(routeProgress(-5),0);
 assert.equal(routeProgress(0),0);
 assert.equal(routeProgress(STORY_DURATION),1);
 assert.equal(routeProgress(STORY_DURATION*3),1);
 let last=-1;
 for(let i=0;i<=200;i++){
  const value=routeProgress(STORY_DURATION*i/200);
  assert.ok(value>=last-1e-10);
  assert.ok(value>=0&&value<=1);
  last=value;
 }
});
test("V6.3 users control storyboard without tracking, CDNs or background timers",()=>{
 const app=read("scripts/v6-three.src.mjs"),html=read("index.html");
 const css=read("styles-v5.css"),ci=read(".github/workflows/preview-checks.yml");
 assert.match(app,/import \{STORY_BEATS,STORY_DURATION,storyAtTime,routeProgress\}/);
 assert.match(app,/courier:\{pos:/);
 assert.match(app,/const beginTour=\(\)=>\{/);
 assert.match(app,/const cancelTour=\(reason="manual"\)=>\{/);
 assert.match(app,/storyElapsed=Math\.min\(STORY_DURATION,storyElapsed\+wallDelta\)/);
 assert.match(app,/routeProgress\(storyElapsed\)/);
 assert.match(app,/storyProgress\.value=step\.progress/);
 assert.match(app,/cancelTour\("complete"\)/);
 assert.match(app,/tourActive:storyActive/);
 assert.match(html,/class="v63-tour" type="button" aria-pressed="false"/);
 assert.match(app,/courier:\{pos:/);
 assert.match(html,/class="v63-story" role="status" aria-live="polite"/);
 assert.match(html,/class="v63-story-progress" max="100" value="0"/);
 assert.match(css,/\.v63-story\[hidden\]\{display:none!important;\}/);
 assert.match(ci,/node scripts\/v6-gpu-browser-audit\.mjs/);
 assert.match(ci,/permissions:\s*\n\s*contents:\s*read/);
 assert.doesNotMatch(app,/setInterval\s*\(|setTimeout\s*\(|\bfetch\s*\(|WebSocket|localStorage/);
 assert.doesNotMatch(ci,/pages:\s*write|id-token:\s*write|wrangler pages deploy/);
});
