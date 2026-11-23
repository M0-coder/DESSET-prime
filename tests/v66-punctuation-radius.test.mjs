import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
const root=new URL("../",import.meta.url);
const read=path=>readFileSync(new URL(path,root),"utf8");
const html=read("index.html"),css=read("styles.css"),extra=read("styles-v5.css");

function visibleText(markup){
 return markup.replace(/<[^>]+>/g," ").replace(/\s+/g," ").trim();
}

test("V6.6 all presentation headings and standalone labels omit terminal ornamental dots",()=>{
 const headings=[...html.matchAll(/<(h[1-4]|strong)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
  .map(x=>({tag:x[1],text:visibleText(x[2])}));
 assert.ok(headings.length>=16,"Expected all six sections to be inspected");
 for(const heading of headings)
  assert.ok(!/[.]$/.test(heading.text),"Ornamental full stop remains in "+heading.tag+": "+heading.text);
 assert.match(html,/aria-label="Tres momentos conceptuales de un pedido: elegir, preparar y entregar"/);
 assert.match(html,/aria-label="Escena tridimensional conceptual de DESSET"/);
 assert.doesNotMatch(html,/id="ecosystem-title"/);
 assert.doesNotMatch(html,/>COMERCIO · TECNOLOGÍA · LOGÍSTICA<\/p>/);
 assert.match(html,/id="hero-title"/);
 assert.match(html,/CENTRO · FLOTA · MUELLES/);
 for(const action of ["ELEGIR","PREPARAR","ENTREGAR"])
  assert.ok(html.includes("<h3>"+action+"</h3>"),"Missing clean action "+action);
 assert.doesNotMatch(html,/<h3>[^<]+<span>\.<\/span><\/h3>/);
 assert.doesNotMatch(html,/v4-fullstop/);
 assert.doesNotMatch(css,/\.v4-fullstop\s*\{|\.motion-story-unit h3 span\s*\{/);
});

test("V6.6 punctuation stays in natural prose and legal availability disclosures",()=>{
 assert.match(html,/DESSET reúne comercio, tecnología y logística en un ecosistema de servicios/);
 assert.match(html,/Sitio institucional: los pedidos y pagos corresponden a las aplicaciones DESSET/);
 assert.match(html,/no procesa pedidos ni pagos\./);
 assert.doesNotMatch(html,/prime-photo-caption|Representación conceptual · No corresponde a operaciones activas de DESSET/);
 assert.match(html,/aria-label="Escena conceptual:/);
 assert.match(html,/data-service-status[^>]*>Acceso público no habilitado/);
 assert.match(html,/Acceso público no habilitado/);
 assert.match(html,/Esta web no procesa transacciones\./);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
});

test("V6.6 rounded design uses disciplined radius scale, not global clipping",()=>{
 assert.match(extra,/--prime-radius-sm:12px/);
 assert.match(extra,/--prime-radius-md:18px/);
 assert.match(extra,/--prime-radius-lg:26px/);
 for(const selector of [
  '.hero[data-variant="v4"] .v4-motion-canvas',
  '.service,.business-pitch,.ecosystem-board',
  '.v5-city-stage',
  '.v4-architecture-inner',
  '.v6-three-controls button,.v6-enable-webgl',
  '.v63-story,.v65-load-status'
 ])assert.ok(extra.includes(selector),"Missing radius target "+selector);
 assert.match(extra,/@media\(max-width:700px\)/);
 assert.doesNotMatch(extra,/(?:^|\n)\s*\*\s*\{[^}]*border-radius:/);
 assert.ok(statSync(new URL("styles-v5.css",root)).size<=16000,"V5 style gate exceeded");
 assert.match(extra,/prefers-reduced-motion:reduce/);
 assert.match(css,/a:focus-visible,button:focus-visible/);
});

test("V6.6 change is limited to presentation: no commerce launch or public publishing",()=>{
 assert.equal((html.match(/<section\b/g)||[]).length,6);
 assert.doesNotMatch(html,/data-v64-tour-launch/);
 assert.match(html,/id="ecosistema" aria-label/);
 assert.match(html,/class="v63-tour"/);
 assert.match(html,/class="v6-three-mount" aria-hidden="true"/);
 assert.match(html,/href="#contacto"/);
 assert.doesNotMatch(html,/<form\b|<iframe\b/i);
 assert.equal((html.match(/data-channel-review="owner-attested" data-channel-basis="owner-attested"/g)||[]).length,5);
});
