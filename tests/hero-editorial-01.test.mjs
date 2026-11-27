import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
import {runInNewContext} from "node:vm";
import {reviewEditorialHomeHero} from "../scripts/prime-manual-cutover-gate.mjs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url));
const approved=[{"path":"assets/desset-hero-editorial.mp4","sha256":"76944235866393f12d88c4ce3869cdf984a13805638af441747f59f318a725b0","bytes":6958330,"kind":"video"},{"path":"assets/desset-hero-editorial-poster.webp","sha256":"e5e3722b910fbc76570c4d9195a44e3508fc3bf56ea1350b2952251af8e3f97b","bytes":51140,"kind":"poster"}];
test("HERO-EDITORIAL-01 exact authorized media and truthful provenance",()=>{const m=JSON.parse(read("config/prime-selected-media.json"));assert.equal(reviewEditorialHomeHero(m).accepted,true);for(const a of approved){const data=read(a.path);assert.equal(data.length,a.bytes);assert.equal(createHash("sha256").update(data).digest("hex"),a.sha256);}const changed=structuredClone(m);changed.editorial_home_hero.assets[0].sha256="0".repeat(64);assert.equal(reviewEditorialHomeHero(changed).accepted,false);for(const mutate of [x=>x.editorial_home_hero.source_clips[0].id="0000000",x=>x.editorial_home_hero.release_authorized=true,x=>x.editorial_home_hero.exclusive_ownership_claim=true,x=>x.editorial_home_hero.assets[1].sha256="0".repeat(64)]){const candidate=structuredClone(m);mutate(candidate);assert.equal(reviewEditorialHomeHero(candidate).accepted,false);}});
test("HERO-EDITORIAL-01 local poster and deferred video, no native video controls and unchanged indexing",()=>{const h=read("index.html").toString(),s=read("styles-hero-editorial.css").toString(),j=read("scripts/hero-editorial.js").toString();assert.match(h,/name="robots" content="noindex,nofollow"/);assert.match(h,/class="brand-mark" src="\.\/assets\/deliver-assets-mark\.png"/);assert.match(h,/width="1920" height="960"/);assert.match(h,/data-src="\.\/assets\/desset-hero-editorial\.mp4" muted loop playsinline preload="none"/);assert.doesNotMatch(h,/desset-editorial-toggle|class="institutional-recent"/);assert.match(h,/aria-controls="hero-messages desset-editorial-video"/);assert.doesNotMatch(h,/<video[^>]*\scontrols\b/);assert.match(h,/class="desset-home-cinematic"/);assert.match(h,/href="\.\/mision-vision-valores\.html#proposito"/);assert.match(s,/height:78svh/);assert.match(s,/margin:-36px auto 0/);assert.match(s,/position:absolute;inset:0 0 auto/);assert.match(s,/prefers-reduced-motion:reduce/);assert.match(j,/userPaused/);assert.doesNotMatch(j,/editorial-toggle/);assert.match(j,/reduced\.matches/);assert.match(j,/document\.hidden/);assert.doesNotMatch(j,/fetch\s*\(|eval\s*\(/);});

test("HERO-MESSAGES-01 exact approved copy, measured scene cuts and no independent timer",()=>{
 const html=read("index.html").toString(),js=read("scripts/hero-editorial.js").toString();
 const cues=[...html.matchAll(/<span data-at="([^"]+)" aria-hidden="([^"]+)">([^<]+)<\/span>/g)].map(m=>[Number(m[1]),m[2],m[3]]);
 assert.deepEqual(cues,[[0,"false","Tu negocio, más cerca de las personas."],[2.4,"true","Más tiempo para lo que importa."],[4.4,"true","Cada origen, conectado con su destino."],[7.8,"true","Nuevas oportunidades en cada recorrido."]]);
 assert.match(html,/class="hero-message-pause"[^>]* hidden>/);
 assert.doesNotMatch(js,/setInterval|setTimeout|requestAnimationFrame/);
 assert.match(js,/timeupdate/);
 assert.ok(read("styles-hero-editorial.css").length<=6500);
 assert.ok(read("scripts/hero-editorial.js").length<=3500);
});
test("HERO-MESSAGES-01 playback, real cut points, looping, pause and reduced motion",async()=>{
 const make=(o={})=>Object.assign({events:{},attrs:{},addEventListener(n,f){this.events[n]=f},setAttribute(n,v){this.attrs[n]=v},getAttribute(n){return this.attrs[n]??null},removeAttribute(n){delete this.attrs[n];if(n==="data-ready")delete this.dataset.ready}},o);
 const cues=[0,2.4,4.4,7.8].map(at=>make({dataset:{at:String(at)}}));
 const copy=make({querySelectorAll:()=>cues}),control=make({hidden:true}),reduced=make({matches:false});
 const v=make({dataset:{src:"./assets/desset-hero-editorial.mp4"},currentTime:0,paused:true,async play(){this.paused=false},pause(){this.paused=true}});
 Object.defineProperty(v,"src",{set(s){this.attrs.src=s}});
 const doc=make({hidden:false,querySelector:s=>({"#desset-editorial-video":v,"#hero-messages":copy,".hero-message-pause":control}[s])});
 runInNewContext(read("scripts/hero-editorial.js").toString(),{document:doc,matchMedia:()=>reduced});
 await Promise.resolve();await Promise.resolve();
 assert.equal(control.hidden,false);
 const active=()=>cues.findIndex(c=>c.attrs["aria-hidden"]==="false");
 for(const [t,i] of [[0,0],[2.39,0],[2.4,1],[4.39,1],[4.4,2],[6,2],[7.8,3],[9.99,3],[0,0]]){
  v.currentTime=t;v.events.timeupdate();assert.equal(active(),i);
 }
 control.events.click();assert.equal(v.paused,true);assert.match(control.attrs["aria-label"],/Reanudar/);
 doc.events.visibilitychange();assert.equal(v.paused,true);
 control.events.click();await Promise.resolve();await Promise.resolve();assert.equal(v.paused,false);
 reduced.matches=true;reduced.events.change();assert.equal(v.paused,true);assert.equal(control.hidden,true);assert.equal(active(),0);
});
