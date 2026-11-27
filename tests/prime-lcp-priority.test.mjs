import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const source=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const output=readFileSync(new URL("../dist/index.html",import.meta.url),"utf8");
const poster="./assets/desset-hero-editorial-poster.webp";
function check(html){
 const all=[...html.matchAll(/<link\s+[^>]*rel="preload"[^>]*>/g)].map(x=>({tag:x[0],index:x.index}));
 const assets=all.filter(x=>x.tag.includes('as="image"'));
 assert.equal(assets.length,1,"Exactly one approved panoramic poster preload");
 const {tag,index}=assets[0];
 assert.ok(tag.includes('href="'+poster+'"')&&tag.includes('type="image/webp"')&&tag.includes('fetchpriority="high"')&&!tag.includes('media='));
 assert.ok(index<html.indexOf('href="./fonts/'));
 const mainStyle=html.match(/href="\.\/styles\.css\?v=[a-f0-9]{40}"/);
 assert.ok(mainStyle&&index<mainStyle.index);
 assert.match(html,/class="prime-photo-image"[^>]*src="\.\/assets\/desset-hero-editorial-poster\.webp"[^>]*loading="eager" fetchpriority="high"/);
 assert.match(html,/data-src="\.\/assets\/desset-hero-editorial\.mp4" muted loop playsinline preload="none"/);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
}
test("Hero source and packaged output preload the single approved poster",()=>{check(source);check(output)});
test("No photo bytes, fonts, WebGL or typography were replaced to obtain the performance result",()=>{
 assert.match(source,/fonts\/inter-latin-variable\.woff2/);
 assert.match(source,/fonts\/plus-jakarta-sans-latin-variable\.woff2/);
 assert.match(readFileSync(new URL("../prime.html",import.meta.url),"utf8"),/class="v6-three-mount" aria-hidden="true"/);
 assert.match(readFileSync(new URL("../prime.html",import.meta.url),"utf8"),/class="v63-tour"/);
 const manifest=JSON.parse(readFileSync(new URL("../dist/site-manifest.json",import.meta.url),"utf8"));
 for(const name of ["desset-hero-entrega-mobile.webp","desset-hero-entrega-dos-espejos.webp"]){
  const mediaFile=manifest.files.find(f=>f.path==="assets/"+name);
  assert.ok(mediaFile&&mediaFile.bytes>10000&&mediaFile.sha256.length===64);
 }
});
test("Mobile LCP entrance finishes promptly without changing desktop or reduced motion",()=>{
 const original=readFileSync(new URL("../styles-hero-photo.css",import.meta.url),"utf8");
 const packed=readFileSync(new URL("../dist/styles-hero-photo.css",import.meta.url),"utf8");
 assert.equal(packed,original,"Source and verified packaged CSS must match exactly");
 assert.match(original,/animation:anim02-frame 1\.35s/,"Retain desktop composition and keyframes");
 assert.match(original,/animation:anim02-focus 2\.05s/,"Retain desktop image-focus animation");
 assert.match(original,/@media \(max-width:700px\) and \(prefers-reduced-motion:no-preference\)\{\s*#inicio \.prime-photo-surface,#inicio \.prime-photo-image\{animation-duration:\.65s;animation-delay:0s\}/);
 assert.match(original,/@media\(prefers-reduced-motion:reduce\)[\s\S]*#inicio \.prime-photo-surface[\s\S]*animation:none!important/);
 assert.match(original,/@keyframes anim02-frame\{/);
});
