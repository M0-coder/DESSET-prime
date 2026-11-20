import test from "node:test";import assert from "node:assert/strict";import{readFileSync,statSync}from"node:fs";
const root=new URL("../",import.meta.url);const read=p=>readFileSync(new URL(p,root),"utf8");
const html=read("index.html"),css=read("styles-visual02.css"),browser=read("scripts/browser-audit.mjs");
test("VISUAL-03 uses only approved branded photo and original SVG backups",()=>{
 assert.equal((html.match(/<picture class="v03-photo-story">/g)||[]).length,3);
 assert.equal((html.match(/srcset="\.\/assets\/desset-hero-entrega-dos-espejos\.webp"/g)||[]).length,3);
 for(const file of ["scene-choose.svg","scene-prepare.svg","scene-move.svg"])assert.match(html,new RegExp('src="\\./assets/'+file.replace(".","\\.")+'"'));
 for(const name of ["ELEGIR","PREPARAR","ENTREGAR"])assert.match(html,new RegExp("<h3>"+name+"</h3>"));
 assert.match(html,/motocicleta de dos espejos/);assert.match(html,/Hablemos de tu negocio/);
 assert.match(html,/deliver-assets-mark\.png/);assert.match(html,/name="robots" content="noindex,nofollow"/);
});
test("VISUAL-03 static art has separate crops, reduced-motion safety and bounded CSS",()=>{
 assert.match(css,/\.motion-story-art--choose \.v03-photo-story img\{left:0\}/);
 assert.match(css,/\.motion-story-art--organize \.v03-photo-story img\{left:-40%\}/);
 assert.match(css,/\.motion-story-art--move \.v03-photo-story img\{left:-100%\}/);
 assert.match(css,/\.v03-photo-story img\{position:absolute;top:0;width:200%/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{#ecosistema \.v03-photo-story img/);
 assert.ok(statSync(new URL("styles-visual02.css",root)).size<=5200);
 assert.doesNotMatch(css,/https?:\/\/|@import|@font-face/);
 assert.match(browser,/VISUAL-03 approved photograph, three narrative views and SVG fallback/);
});
