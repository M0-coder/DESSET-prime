import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../',import.meta.url), read=p=>readFileSync(new URL(p,root),'utf8');
const html=read('index.html'),css=read('styles-hero-photo.css'),build=read('scripts/build-site.mjs'),verify=read('scripts/verify-site-package.mjs'),gate=read('scripts/static-gate.mjs');
test('HERO-PHOTO-01 official brand and direct commerce CTA are retained',()=>{
 assert.match(html,/class="brand-mark" src="\.\/assets\/deliver-assets-mark\.png"/);
 assert.match(html,/Hablemos de tu negocio/);
 assert.match(html,/EL COMERCIO/);assert.match(html,/SE MUEVE/);
 assert.doesNotMatch(html,/data-v64-tour-launch/);
 assert.match(html,/class="v5-city-stage"/);
 assert.match(html,/class="v63-tour"/);
 assert.doesNotMatch(html,/IDEAS<\/span>|ACCIÓN<\/span>|cuaderno/i);
 assert.doesNotMatch(html,/prime-photo-caption|Representación conceptual · No corresponde a operaciones activas de DESSET/);
 assert.match(html,/aria-label="Escena conceptual:/);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
});
test('HERO-PHOTO-01 exact locally packaged user-approved image with two mirrors',()=>{
 const data=readFileSync(new URL('assets/desset-hero-entrega-dos-espejos.webp',root));
 assert.equal(data.subarray(0,4).toString(),'RIFF');assert.equal(data.subarray(8,12).toString(),'WEBP');
 assert.ok(data.length>100000&&data.length<=210000);
 assert.equal(createHash('sha256').update(data).digest('hex'),'9f7940ed40dac21dcd286655930750ffd1008cf84830ed8b2e086a40c4cd00f1');
 assert.match(html,/src="\.\/assets\/desset-hero-entrega-dos-espejos\.webp"/);
 assert.match(html,/width="1671" height="941"/);
 assert.match(html,/srcset="\.\/assets\/desset-hero-entrega-mobile\.webp"/);
 const mobile=readFileSync(new URL("assets/desset-hero-entrega-mobile.webp",root));
 assert.ok(mobile.length<=85000);
 assert.equal(createHash("sha256").update(mobile).digest("hex"),"4a2043a8dfceb15d5f4cc008904feb49467a42f79f8f9c54db2bdcad0e33767e");
 assert.match(html,/loading="eager" fetchpriority="high"/);
});
test('HERO-PHOTO-01 two-column mockup, responsive, reduced motion and real 3D remain',()=>{
 assert.match(css,/grid-template-columns:minmax\(0,\.92fr\) minmax\(0,1\.08fr\)/);
 assert.match(css,/prime-photo-hero-enter/);
 assert.match(css,/@media\(max-width:860px\)/);assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 assert.match(css,/@media\(max-width:700px\)\{#inicio \.prime-photo-image\{object-position:100% 50%\}\}/);
  assert.doesNotMatch(css,/\.prime-photo-surface \.v4-shape/);
 assert.doesNotMatch(css,/url\(\s*["']?https?:|@import|animation-iteration-count:\s*infinite/i);
 assert.ok(statSync(new URL('styles-hero-photo.css',root)).size<=9500);
});
test('HERO-PHOTO-01 real site build, local browser proof, security gate include asset',()=>{
 assert.match(build,/styles-hero-photo\.css/);
 assert.match(verify,/Approved photographic render is not packaged/);
 assert.match(gate,/hero_webp_bytes:210000/);
 assert.match(read('scripts/browser-audit.mjs'),/HERO-PHOTO-01 exact local render, original logo, conceptual disclosure/);
 assert.match(html,/href="\.\/styles-hero-photo\.css"/);
});
