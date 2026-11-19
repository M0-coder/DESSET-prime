import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");

test("trust starts with a definite business direction but contains no active-service or corporate-registration claim",()=>{
 assert.match(html,/EL COMERCIO/);
 assert.match(html,/En DESSET estamos construyendo un sistema/);
 assert.match(html,/Comenzamos por la última milla/);
 assert.doesNotMatch(html,/somos líderes|miles de clientes|servicios disponibles hoy|empresa registrada|RUC:\s*\d+|seguimiento en tiempo real/i);
 assert.match(html,/Nuestra tarea es concreta: desarrollar herramientas/);
 assert.doesNotMatch(html,/trabajo verificable|confianza garantizada|100% confiable/i);
 assert.match(html,/DESSET está en desarrollo/);
 assert.match(html,/Este sitio no procesa pedidos ni pagos/);
});

test("transparent status is explicit, short, and not a decorative trust seal",()=>{
 const panel=html.match(/<div class="trust-ledger" aria-labelledby="trust-ledger-title">([\s\S]*?)<\/div>\s*<\/section>/)?.[1]||"";
 assert.ok(panel.length>500);
 assert.match(panel,/id="trust-ledger-title"/);
 assert.match(panel,/CLARIDAD DESDE EL PRINCIPIO/);
 assert.equal((panel.match(/class="trust-ledger-item"/g)||[]).length,3);
 for(const phase of ["Pedidos y última milla.","En construcción.","Aún sin operación comercial."])
  assert.ok(panel.includes(phase),"Missing credible state "+phase);
 assert.doesNotMatch(panel,/class="trust-ledger-item"><span>/);
 assert.match(panel,/En construcción/);
 assert.match(panel,/Siguiente paso: validar necesidades con comercios/);
 assert.match(panel,/Aún sin operación comercial/);
 assert.match(panel,/No se reciben pedidos, pagos ni contrataciones desde esta web/);
 assert.doesNotMatch(panel,/100% seguro|certificado|verificado por|avalado por|garantizado/i);
});

test("contact promises only an existing link, not verified ownership or DM responsiveness",()=>{
 assert.match(html,/Ver perfil en Instagram/);
 assert.match(html,/data-channel-review="pending"/);
 assert.equal((html.match(/class="contact-primary"/g)||[]).length,1);
 assert.doesNotMatch(html,/Abrir Instagram para conversar|contacto verificado|responderemos en|WhatsApp oficial/i);
 assert.doesNotMatch(html,/<form\b|<input\b/i);
});

test("trust content stays in the existing six-section information hierarchy and has mobile rules",()=>{
 assert.equal((html.match(/<section\b/g)||[]).length,6);
 const pos=html.indexOf('class="trust-ledger"'),s1=html.indexOf('id="vision"'),s2=html.indexOf('id="soluciones"');
 assert.ok(s1<pos && pos<s2);
 assert.match(css,/\.trust-ledger-grid\{display:grid;grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:700px\)\{[\s\S]*?\.trust-ledger-grid\{grid-template-columns:1fr\}/);
 assert.doesNotMatch(css,/\.trust-ledger[^{]*\{[^}]*animation:/);
});
