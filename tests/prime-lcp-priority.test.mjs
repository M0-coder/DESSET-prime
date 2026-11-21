import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const output=readFileSync(new URL("../dist/index.html",import.meta.url),"utf8");
const mobile="./assets/desset-hero-entrega-mobile.webp";
const desktop="./assets/desset-hero-entrega-dos-espejos.webp";
const media=["(max-width: 700px)","(min-width: 701px)"];
function check(html){
 const all=[...html.matchAll(/<link\s+[^>]*rel="preload"[^>]*>/g)].map(x=>({tag:x[0],index:x.index}));
 const assets=all.filter(x=>x.tag.includes('as="image"'));
 assert.equal(assets.length,2,"Only two strictly exclusive approved hero image preloads");
 for(const [i,path] of [mobile,desktop].entries()){
  const found=assets.filter(x=>x.tag.includes('href="'+path+'"'));
  assert.equal(found.length,1,"Missing/doubled hero image preload "+path);
  const {tag}=found[0];
  assert.ok(tag.includes('type="image/webp"')&&tag.includes('fetchpriority="high"'));
  assert.ok(tag.includes('media="'+media[i]+'"'),"Wrong viewport preloading condition");
 }
 assert.ok(assets.every(x=>x.index<html.indexOf('href="./fonts/')),"Hero image must take priority over fonts");
 assert.ok(assets.every(x=>x.index<html.indexOf('href="./styles.css"')),"Hero image discovered before render-blocking CSS");
 assert.match(html,/<source type="image\/webp" media="\(max-width: 700px\)" srcset="\.\/assets\/desset-hero-entrega-mobile\.webp">/);
 assert.match(html,/class="prime-photo-image"[^>]*src="\.\/assets\/desset-hero-entrega-dos-espejos\.webp"[^>]*loading="eager" fetchpriority="high"/);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
}
test("Hero source and signed package preload only matching mobile/desktop LCP art",()=>{check(source);check(output)});
test("No photo bytes, fonts, WebGL or typography were replaced to obtain the performance result",()=>{
 assert.match(source,/fonts\/inter-latin-variable\.woff2/);
 assert.match(source,/fonts\/plus-jakarta-sans-latin-variable\.woff2/);
 assert.match(source,/class="v6-three-mount" aria-hidden="true"/);
 assert.match(source,/class="v63-tour"/);
 const manifest=JSON.parse(readFileSync(new URL("../dist/site-manifest.json",import.meta.url),"utf8"));
 for(const name of ["desset-hero-entrega-mobile.webp","desset-hero-entrega-dos-espejos.webp"]){
  const mediaFile=manifest.files.find(f=>f.path==="assets/"+name);
  assert.ok(mediaFile&&mediaFile.bytes>10000&&mediaFile.sha256.length===64);
 }
});
