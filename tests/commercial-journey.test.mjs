import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
const root=new URL("../",import.meta.url);
const html=readFileSync(new URL("index.html",root),"utf8");
const css=readFileSync(new URL("styles.css",root),"utf8");
const scenes=["choose","prepare","move"];

test("business proposition appears before generic stakeholder cards and keeps an honest launch status",()=>{
 const audience=html.indexOf('id="negocios"');
 const pitch=html.indexOf('class="business-pitch"');
 const cards=html.indexOf('class="audience-grid audience-grid--compact"');
 assert.ok(audience>0 && pitch>audience && cards>pitch,"Commercial value proposition must precede stakeholder cards");
 assert.match(html,/¿TU NEGOCIO/);
 assert.match(html,/<a class="business-pitch-cta" href="#contacto">Ver canales DESSET/);
 assert.match(html,/Un modelo integrado para solicitudes de clientes/);
 assert.match(html,/no representa una operación activa/i);
 assert.match(html,/no procesa pedidos ni pagos/i);
 assert.doesNotMatch(html,/más de [0-9]+ (?:comercios|clientes|repartidores)|entregas en tiempo real|compra ahora/i);
});

test("commercial contact CTA resolves locally and avoids fictitious contact details",()=>{
 const pitch=html.match(/<div class="business-pitch">([\s\S]*?)<div class="audience-grid audience-grid--compact">/);
 assert.ok(pitch);
 assert.match(pitch[1],/href="#contacto"/);
 assert.match(html,/id="contacto"/);
 assert.match(html,/Ver perfil en Instagram/);
 assert.match(html,/href="https:\/\/www\.instagram\.com\/deliver_assets\/"/);
 assert.doesNotMatch(html,/<a\b[^>]+href="(?:mailto:|tel:|https:\/\/wa\.me\/)/i,"Cannot invent or publish personal/uncorroborated contact details");
});

test("three locally illustrated business scenes use original semantics, not generic shape placeholders",()=>{
 const places=["elegir","organizar","mover"];
 for(const [i,scene] of scenes.entries()){
  const path="assets/scene-"+scene+".svg";
  const svg=readFileSync(new URL(path,root),"utf8");
  assert.match(html,new RegExp("src=\"\\./"+path.replace(".","\\.")+"\""));
  assert.match(svg,/<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  assert.match(svg,/<path\b|<rect\b/);
  assert.match(svg,/(#1551D8|#FFC62F|#FF3328)/);
  assert.ok(svg.length>=900 && svg.length<5000,"Vector too empty or unexpectedly large: "+scene);
  assert.ok(statSync(new URL(path,root)).size<5000);
  assert.match(svg,new RegExp('aria-label="[^"]*(?:'+places[i]+'|seleccionando|entrega|pedido|comercio|paquete)[^"]*"','i'));
 }
 assert.equal((html.match(/class="motion-story-art motion-story-art--/g)||[]).length,3);
 assert.match(css,/\.motion-story-art img\{/);
 assert.doesNotMatch(css,/\.motion-story-art--(?:choose|organize|move) span/);
});

test("no fake availability, brand replacement, remote imagery or public checkout",()=>{
 assert.match(html,/DESSET reúne comercio, tecnología y logística en un ecosistema de servicios/);
 assert.match(html,/data-service-status[^>]*>Acceso público no habilitado/);
 assert.match(html,/assets\/deliver-assets-mark\.png/);
 assert.doesNotMatch(html,/<form\b|<input\b|<button[^>]*comprar|https?:\/\/images\./i);
});
