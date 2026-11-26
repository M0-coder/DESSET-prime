import test from "node:test";import assert from "node:assert/strict";import {readFileSync} from "node:fs";import {createHash} from "node:crypto";
const read=p=>readFileSync(new URL("../"+p,import.meta.url));
for(const dir of ["","dist/"])test("VIDEO-01 exact two services, approved local media and no redundant copy "+(dir||"source"),()=>{
 const html=read(dir+"index.html").toString(),block=html.match(/<section class="solutions" id="soluciones"[\s\S]*?<\/section>/)[0];
 assert.equal((block.match(/<video\b/g)||[]).length,2);assert.doesNotMatch(block,/<(?:p|strong|figcaption)\b|Más información/);
 for(const [name,href] of [["desset","aplicaciones.html"],["prime","prime.html"]]){assert.ok(block.includes('data-src="./assets/servicio-'+name+'.mp4"'));assert.ok(block.includes('poster="./assets/servicio-'+name+'-poster.webp"'));assert.ok(block.includes('href="./'+href+'"'));assert.match(block,/muted playsinline preload="none"/);}
 assert.equal((block.match(/Conocer más <svg/g)||[]).length,2);assert.doesNotMatch(block,/<button\b|\sloop\b|\sautoplay\b/);
 const css=read(dir+"styles-service-video.css").toString();assert.match(css,/aspect-ratio:16\/9/);assert.match(css,/object-fit:cover/);assert.match(css,/prefers-reduced-motion/);
 const assets={"servicio-desset.mp4":"592dd2d37d778a57d784195bd866d168243e973f3890064aab11c73e63d68bbc","servicio-prime.mp4":"dcca0f7554c7e3267e141d8f4bdb19acde67f8628932b374ccad0962c19c2081","servicio-desset-poster.webp":"c59181261f58aa6337eb1139e1e814222d1fc6657759795db7fc2a0b788d6733","servicio-prime-poster.webp":"ce1ed66071c700d3a921df00e668571403e6300c33192d7bff426d355c430a3c"};for(const [path,sha] of Object.entries(assets))assert.equal(createHash("sha256").update(read(dir+"assets/"+path)).digest("hex"),sha);
});
