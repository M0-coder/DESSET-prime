import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
for(const dir of ["","dist/"]){
 test("PRIME-01 isolated editorial route and truthful institutional claims "+(dir||"source"),()=>{
 const html=read(dir+"prime.html"),css=read(dir+"styles-prime.css");
 const header=html.match(/<header class="site-header">([\s\S]*?)<\/header>/)?.[1]||"";
 assert.match(header,/<a href="\.\/index\.html" class="brand prime-header-brand" aria-label="DESSET Prime, ir al inicio"><span class="brand-name">DESSET <span class="pr-wordmark">Prime<\/span><\/span><\/a>/);
 assert.doesNotMatch(header,/<img\b|<svg\b|brand-mark/);
 assert.match(css,/\.prime-header-brand \.brand-name\{[^}]*color:#1551d8;[^}]*font-weight:800/);
 assert.match(css,/\.prime-header-brand \.pr-wordmark\{[^}]*font-size:1em;[^}]*font-weight:500;[^}]*font-style:normal;[^}]*color:inherit/);
 assert.match(read(dir+"index.html"),/<img[^>]*class="brand-mark"[^>]*src="\.\/assets\/deliver-assets-mark\.png"/);
 for(const page of ["index","empresa","comercios","repartidores"]){
 const doc=read(dir+page+".html");assert.ok(doc.includes('href="./prime.html">DESSET prime</a>'));assert.ok(!doc.includes("styles-prime.css"));
 }
 const home=read(dir+"index.html"),service=home.match(/<article class="service service--prime">([\s\S]*?)<\/article>/)?.[1];
 assert.ok(service);
 assert.ok(service.includes('<a class="prime-service-cta" href="./prime.html" aria-label="Más información sobre DESSET prime">Más información</a>'));
 assert.equal((home.match(/class="prime-service-cta"/g)||[]).length,1);
 assert.doesNotMatch(home.match(/<article class="service service--main">([\s\S]*?)<\/article>/)?.[1]||"",/prime-service-cta/);
 assert.match(read(dir+"styles.css"),/#soluciones \.service--prime \.prime-service-cta\{[^}]*min-height:48px/);
 assert.ok(html.includes('href="./styles-prime.css"'));
 assert.match(html,/DE ORIGEN A DESTINO\. MÁS ALLÁ DE LAS DISTANCIAS\./);
 assert.match(html,/EL FUTURO NO TIENE FRONTERAS\./);
 for(const name of ["Paquetería","Distribución","Fulfillment","Tecnología logística"])assert.ok(html.includes("<h3>"+name+"</h3>"));
 assert.equal((html.match(/class="pr-card"/g)||[]).length,4);
 const photos=["assets/prime-hero-logistica.webp","assets/prime-paqueteria.webp","assets/prime-distribucion.webp","assets/prime-fulfillment.webp","assets/prime-tecnologia-logistica.webp","assets/prime-vision-internacional.webp"];
 for(const path of photos)assert.equal(html.split('src="./'+path+'"').length,2,'Expected one local photograph: '+path);
 assert.match(html,/<figure class="pr-hero-art"><img[^>]+fetchpriority="high"/);
 assert.equal((html.match(/class="pr-card-art"><img/g)||[]).length,4);
 assert.match(html,/<figure class="pr-vision-art"><img/);
 assert.match(css,/\.pr-vision-art img/);

 assert.match(html,/Una visión logística integral/);
 assert.match(html,/Nuestra visión de largo plazo contempla redes logísticas nacionales e internacionales\./);
 assert.match(html,/Centro logístico ilustrativo/);
 assert.match(html,/Imagen de referencia: vista aérea de un buque de carga en puerto/);
 assert.doesNotMatch(html,/<figcaption\b|class="pr-intro"|class="pr-note"|<p class="pr-kicker">LOGÍSTICA Y DISTRIBUCIÓN<\/p>/);
 assert.doesNotMatch(css,/\.prime-page (?:figcaption|\.pr-intro|\.pr-note)\{/);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
 assert.match(html,/form-action 'none'/);
 assert.doesNotMatch(html,/<(?:form|input|script|iframe)\b/i);
 assert.ok(Buffer.byteLength(css,"utf8")<4500);
 assert.doesNotMatch(css,/@import\b|url\(\s*['"]?https?:/i);
 });
}
