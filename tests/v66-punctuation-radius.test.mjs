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
 assert.ok(headings.length>=22,"Expected all six sections to be inspected");
 for(const heading of headings)
  assert.ok(!/[.]$/.test(heading.text),"Ornamental full stop remains in "+heading.tag+": "+heading.text);
 assert.match(html,/<h2 id="ecosystem-title">Elegir, preparar<br>y entregar<\/h2>/);
 assert.match(html,/>PERSONAS \/ NEGOCIOS \/ ENTREGAS</);
 assert.match(html,/>UNA CONEXIÓN \/ TRES MOMENTOS</);
 for(const action of ["ELEGIR","ORGANIZAR","MOVER"])
  assert.ok(html.includes("<h3>"+action+"</h3>"),"Missing clean action "+action);
 assert.doesNotMatch(html,/<h3>[^<]+<span>\.<\/span><\/h3>/);
 assert.doesNotMatch(html,/v4-fullstop/);
 assert.doesNotMatch(css,/\.v4-fullstop\s*\{|\.motion-story-unit h3 span\s*\{/);
});

test("V6.6 punctuation stays in natural prose and legal availability disclosures",()=>{
 assert.match(html,/En DESSET estamos construyendo un sistema[^<]*entregas\./);
 assert.match(html,/DESSET está en desarrollo\. Esta página informa/);
 assert.match(html,/no procesa pedidos ni pagos\./);
 assert.match(html,/no representa una operación activa\. Las aplicaciones/);
 assert.match(html,/No se reciben pedidos, pagos ni contrataciones desde esta web\./);
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
 assert.match(html,/href="#ecosistema" data-v64-tour-launch/);
 assert.match(html,/class="v6-three-mount" aria-hidden="true"/);
 assert.match(html,/href="#contacto"/);
 assert.doesNotMatch(html,/<form\b|<iframe\b/i);
 assert.equal((html.match(/data-channel-review="pending"/g)||[]).length,3);
});
