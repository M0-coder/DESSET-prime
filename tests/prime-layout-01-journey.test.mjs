import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url),read=p=>readFileSync(new URL(p,root),"utf8");
const html=read("index.html"),css=read("styles.css"),sealed=read("styles-visual02.css");
const slice=(tag)=>{const i=html.indexOf(tag);assert.ok(i>=0,"Section missing: "+tag);const j=html.indexOf("</section>",i);assert.ok(j>i);return html.slice(i,j)};
const vision=slice('<section class="statement" id="vision"'),scene=html.match(/<section class="ecosystem"[\s\S]*?<\/section>/)?.[0]||"";
const photos=["assets/ecosistema-proveedores.webp","assets/ecosistema-comercios.webp","assets/ecosistema-consumidores.webp","assets/ecosistema-operadores-logisticos.webp"];
test("ECOSYSTEM-PARTICIPANTS-01 one ordered four-photo ecosystem separate from 3D",()=>{
 assert.match(vision,/<h2 id="vision-title">NO ES SOLO <span>ENTREGAR<\/span><br><strong class="statement-last">ES CONECTAR<\/strong><\/h2>/);
 assert.deepEqual([...vision.matchAll(/<h3>(.*?)<\/h3>/g)].map(x=>x[1]),["PROVEEDORES","COMERCIOS","PERSONAS","OPERADORES LOGÍSTICOS"]);
 assert.equal((vision.match(/class="motion-story-unit motion-story-unit--/g)||[]).length,4);
 assert.equal((vision.match(/<picture class="v03-photo-story">/g)||[]).length,4);
 for(const path of photos){assert.ok(vision.includes('src="./'+path+'"'));assert.ok(!scene.includes(path))}
 assert.doesNotMatch(scene,/motion-story-unit|v03-photo-story|ecosistema-(?:proveedores|comercios|consumidores|operadores-logisticos)\.webp/);
 assert.equal(scene,"","Redundant section must not exist in DOM");
 for(const cls of ["v6-three-mount","v63-tour","v6-pause"]){assert.ok(!scene.includes('class="'+cls+'"'));assert.ok(read("prime.html").includes('class="'+cls+'"'));}
});
test("Four distinct local WebP photos and truthful explanatory copy",()=>{
 for(const path of photos)assert.equal(vision.split('src="./'+path+'"').length-1,1);
 assert.doesNotMatch(vision,/scene-(?:choose|prepare|move)\.(?:webp|svg)/);
 for(const copy of ["Productos y abastecimiento para los negocios.","Canales de venta, gestión de pedidos y acceso a clientes.","Acceso a productos, negocios y servicios.","Recogida, transporte y distribución de mercancías."])assert.ok(vision.includes(copy));
 assert.doesNotMatch(vision,/Modelo de servicios en desarrollo\.|ecosystem-participants-note|<h3>CONSUMIDORES<\/h3>/);
 assert.match(read("prime.html"),/Simulación logística conceptual de DESSET prime/);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
});
test("Heading above four cards, two on tablet, one on narrow screens, no hiding or remote assets",()=>{
 const scoped=css.slice(css.indexOf("/* ECOSYSTEM-PARTICIPANTS-01"));
 assert.match(scoped,/\.statement-body\.ecosystem-participants-body\{display:block/);
 assert.match(scoped,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.match(scoped,/@media\(max-width:1000px\)[\s\S]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(scoped,/@media\(max-width:480px\)[\s\S]*grid-template-columns:minmax\(0,1fr\)/);
 assert.match(scoped,/aspect-ratio:3\/2/);
 assert.match(scoped,/object-fit:cover/);
 assert.match(scoped,/animation:none/);
 assert.doesNotMatch(scoped,/display:\s*none|@import|https?:\/\//);
 assert.ok(Buffer.byteLength(css,"utf8")<=45000);assert.ok(Buffer.byteLength(sealed,"utf8")<=8200);
});
test("Exact local package contains all four photos and preserves original 3D assets",()=>{
 assert.equal(read("dist/index.html"),html);
 assert.equal(read("dist/styles.css"),css);
 assert.equal(read("dist/styles-visual02.css"),sealed);
 const manifest=JSON.parse(read("dist/site-manifest.json"));
 for(const path of [...photos,"assets/v62-commerce.glb","assets/v62-courier.glb","assets/v62-destination.glb"])assert.ok(manifest.files.find(x=>x.path===path),"Mandatory model/photo missing: "+path);
 assert.equal(manifest.noindex,true);assert.equal(manifest.domain,"none");
});
