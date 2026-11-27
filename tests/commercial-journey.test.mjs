import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
const root=new URL("../",import.meta.url);
const html=readFileSync(new URL("index.html",root),"utf8");
const css=readFileSync(new URL("styles.css",root),"utf8");
const scenes=["ecosistema-proveedores","ecosistema-comercios","ecosistema-consumidores","ecosistema-operadores-logisticos"];

test("Two direct commercial contact paths replace generic stakeholder cards",()=>{
 const section=html.match(/<section class="audiences" id="negocios"[^>]*>([\s\S]*?)<\/section>/)?.[1];
 assert.ok(section);
 const cards=[...section.matchAll(/<article class="(business-pitch|audience)">([\s\S]*?)<\/article>/g)];
 assert.deepEqual(cards.map(c=>c[1]),["business-pitch","audience"]);
 assert.match(cards[0][2],/<h3>Comercios<\/h3>/);
 assert.match(cards[1][2],/<h3>Repartidores<\/h3>/);
 assert.doesNotMatch(section,/¿TU NEGOCIO|<h3>Personas|<h3>Aliados|business-pitch-body|Plantear una colaboración/);
 assert.match(html,/Conectamos personas, negocios y mercados/);assert.match(html,/href="\.\/aplicaciones\.html" aria-label="Conocer más sobre las aplicaciones DESSET"/);
 assert.match(readFileSync(new URL("../prime.html",import.meta.url),"utf8"),/No corresponde a pedidos ni entregas activas/i);
 assert.match(readFileSync(new URL("../empresa.html",import.meta.url),"utf8"),/no procesa pedidos ni pagos\./i);
 assert.doesNotMatch(html,/más de [0-9]+ (?:comercios|clientes|repartidores)|entregas en tiempo real|compra ahora/i);
});

test("commercial contact CTA resolves locally and avoids fictitious contact details",()=>{
 const section=html.match(/<section class="audiences" id="negocios"[^>]*>([\s\S]*?)<\/section>/)?.[1];
 assert.ok(section);
 assert.deepEqual([...section.matchAll(/<a class="(?:business-pitch-cta|partner-cta)" href="([^"]+)" aria-label="([^"]+)">([^<]+)/g)].map(c=>[c[1],c[2],c[3].trim()]),[["./comercios.html","Más información para comercios","Más información"],["./repartidores.html","Más información para repartidores","Más información"]]);
 assert.match(html,/id="contacto"/);
 assert.match(html,/data-footer-channel="Instagram" aria-label="Instagram"/);
 assert.match(html,/data-footer-channel="TikTok" aria-label="TikTok"/);
 assert.match(html,/data-footer-channel="YouTube" aria-label="YouTube"/);
 assert.match(html,/href="https:\/\/www\.instagram\.com\/deliver_assets\/"/);
 assert.doesNotMatch(html,/<a\b[^>]+href="(?:mailto:|tel:|https:\/\/wa\.me\/)/i,"Cannot invent or publish personal/uncorroborated contact details");
});

test("four independently chosen local photographs and concrete participant roles",()=>{
 for(const scene of scenes){
  const path="assets/"+scene+".webp",bytes=readFileSync(new URL(path,root));
  assert.ok(html.includes('src="./'+path+'"'));
  assert.equal(bytes.toString("ascii",0,4),"RIFF");
  assert.equal(bytes.toString("ascii",8,12),"WEBP");
  assert.ok(statSync(new URL(path,root)).size<=225000);
 }
 assert.equal((html.match(/class="motion-story-art motion-story-art--/g)||[]).length,4);
 assert.match(css,/grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
 assert.doesNotMatch(html,/Modelo de servicios en desarrollo\.|ecosystem-participants-note/);
 assert.doesNotMatch(css,/\.motion-story-art--(?:choose|organize|move) span/);
});

test("no fake availability, brand replacement, remote imagery or public checkout",()=>{
 assert.match(html,/Conectamos personas, negocios y mercados/);
 assert.doesNotMatch(html,/APLICACIONES DESSET|Acceso público no habilitado|data-service-access|data-app-links/);
 assert.match(html,/assets\/deliver-assets-mark\.png/);
 assert.doesNotMatch(html,/<form\b|<input\b|<button[^>]*comprar|https?:\/\/images\./i);
});
