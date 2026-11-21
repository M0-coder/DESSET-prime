import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url),read=p=>readFileSync(new URL(p,root),"utf8");
const html=read("index.html"),css=read("styles-visual02.css");
const slice=(tag)=>{const i=html.indexOf(tag);assert.ok(i>=0,"Section missing: "+tag);const j=html.indexOf("</section>",i);assert.ok(j>i);return html.slice(i,j)};
const vision=slice('<section class="statement" id="vision"');
const scene=slice('<section class="ecosystem" id="ecosistema"');
test("PRIME-LAYOUT-01 places one ordered three-photo journey at the marked navy statement, not inside the 3D exhibit",()=>{
 assert.match(vision,/<h2 id="vision-title">NO ES SOLO/);
 assert.match(vision,/class="v4-flow motion-story statement-journey"/);
 assert.deepEqual([...vision.matchAll(/<h3>(ELEGIR|PREPARAR|ENTREGAR)<\/h3>/g)].map(x=>x[1]),["ELEGIR","PREPARAR","ENTREGAR"]);
 assert.equal((vision.match(/class="motion-story-unit motion-story-unit--/g)||[]).length,3);
 assert.equal((vision.match(/<picture class="v03-photo-story">/g)||[]).length,3);
 assert.doesNotMatch(scene,/motion-story-unit|v03-photo-story|scene-(?:choose|prepare|move)\.(?:webp|svg)/);
 assert.match(scene,/class="v6-three-mount"/);
 assert.match(scene,/class="v63-tour"/);
 assert.match(scene,/class="v6-pause"/);
 assert.match(scene,/class="v4-architecture-details"/);
});
test("Original WebP and SVG fallbacks retained exactly once with honest explanatory copy",()=>{
 for(const key of ["choose","prepare","move"]){
  assert.equal((html.match(new RegExp('srcset="\\./assets/scene-'+key+'\\.webp"',"g"))||[]).length,1);
  assert.equal((html.match(new RegExp('src="\\./assets/scene-'+key+'\\.svg"',"g"))||[]).length,1);
 }
 for(const copy of ["Explorar opciones y gestionar solicitudes","Reunir la información del pedido","Conectar la preparación comercial"])assert.ok(vision.includes(copy));
 assert.match(scene,/Renderización gráfica conceptual de DESSET/);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
});
test("Layout has two columns on desktop and responsive compact cards without hiding content or changing fonts",()=>{
 assert.match(css,/#vision \.statement-body\{\s*display:grid;grid-template-columns:minmax\(0,\.86fr\) minmax\(0,1\.14fr\)/);
 assert.match(css,/#vision \.statement-journey \.motion-story-grid\{\s*display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:1100px\)/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/@media\(max-width:360px\)/);
 assert.match(css,/#vision \.v03-photo-story img\{display:block;width:100%;height:100%;object-fit:cover/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{#vision \.v03-photo-story img\{animation:none!important/);
 assert.doesNotMatch(css,/#vision[^\n]*\{[^}]*display:\s*none/);
 assert.ok(Buffer.byteLength(css,"utf8")<=8200,"VISUAL-02 byte budget");
});
test("The relocation is included in the signed no-deploy site and removes no 3D media",()=>{
 assert.equal(read("dist/index.html"),html);
 assert.equal(read("dist/styles-visual02.css"),css);
 const manifest=JSON.parse(read("dist/site-manifest.json"));
 for(const path of ["assets/v62-commerce.glb","assets/v62-courier.glb","assets/v62-destination.glb","assets/scene-choose.webp","assets/scene-prepare.webp","assets/scene-move.webp"])assert.ok(manifest.files.find(x=>x.path===path),"Mandatory scene/photo missing: "+path);
 assert.equal(manifest.noindex,true);assert.equal(manifest.domain,"none");
});
