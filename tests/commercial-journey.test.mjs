import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
const root=new URL("../",import.meta.url);
const html=readFileSync(new URL("index.html",root),"utf8");
const css=readFileSync(new URL("styles.css",root),"utf8");
const scenes=["ecosistema-proveedores","ecosistema-comercios","ecosistema-consumidores","ecosistema-operadores-logisticos"];

test("business proposition appears before generic stakeholder cards and keeps an honest launch status",()=>{
 const audience=html.indexOf('id="negocios"');
 const pitch=html.indexOf('class="business-pitch"');
 const cards=html.indexOf('class="audience-grid audience-grid--compact"');
 assert.ok(audience>0 && pitch>audience && cards>pitch,"Commercial value proposition must precede stakeholder cards");
 assert.match(html,/¿TU NEGOCIO/);
 assert.match(html,/Conversemos sobre tu comercio/);
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
 assert.match(html,/Instagram <span/);
 assert.match(html,/TikTok <span/);
 assert.match(html,/YouTube <span/);
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
 assert.match(html,/Modelo de servicios en desarrollo\./);
 assert.doesNotMatch(css,/\.motion-story-art--(?:choose|organize|move) span/);
});

test("no fake availability, brand replacement, remote imagery or public checkout",()=>{
 assert.match(html,/DESSET integra una visión de comercio digital y coordinación logística, con servicios de última milla/);
 assert.match(html,/data-service-status[^>]*>Acceso público no habilitado/);
 assert.match(html,/assets\/deliver-assets-mark\.png/);
 assert.doesNotMatch(html,/<form\b|<input\b|<button[^>]*comprar|https?:\/\/images\./i);
});
