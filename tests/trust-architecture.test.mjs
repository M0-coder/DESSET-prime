import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const html=readFileSync(new URL("../index.html",import.meta.url),"utf8");
const css=readFileSync(new URL("../styles.css",import.meta.url),"utf8");

test("institutional statement retains business direction without fictitious operations or registration",()=>{
 assert.match(html,/EL COMERCIO/);
 assert.match(html,/NO ES SOLO/);
 assert.match(html,/ES CONECTAR/);
 assert.match(html,/DESSET reúne comercio, tecnología y logística en un ecosistema de servicios/);
 assert.match(html,/orientado a la última milla/);
 assert.doesNotMatch(html,/somos líderes|miles de clientes|servicios disponibles hoy|empresa registrada|RUC:\s*\d+|seguimiento en tiempo real/i);
 assert.doesNotMatch(html,/Comercio, tecnología y distribución se integran en una misma arquitectura/);
 assert.match(html,/Sitio institucional: los pedidos y pagos corresponden a las aplicaciones DESSET/);
 assert.match(html,/Este sitio no procesa pedidos ni pagos/);
});

test("truthful service and conceptual 3D disclosures remain without redundant three-pillar trust panels",()=>{
 const flow=html.match(/<section class="ecosystem"[\s\S]*?<\/section>/)?.[0]||"";
 assert.ok(flow.length>1500,"Actual three-step flow must remain");
 assert.match(flow,/class="v6-three-mount"/);
 assert.match(flow,/aria-label="Renderización gráfica conceptual de DESSET"/);
 assert.match(flow,/class="v6-static-fallback"/);
 assert.match(html,/Representación conceptual · No corresponde a operaciones activas de DESSET/);
 assert.doesNotMatch(flow,/v5-stage-caption|motion-story-bridge/);
 for(const stage of ["ELEGIR","PREPARAR","ENTREGAR"])
  assert.ok(flow.includes("<h3>"+stage+"</h3>"),"Real conceptual stage missing: "+stage);
 assert.match(html,/data-service-status[^>]*>Acceso público no habilitado/);
 assert.match(html,/Esta web no procesa transacciones/);
 assert.doesNotMatch(html,/class="trust-ledger"|UN ECOSISTEMA, TRES PILARES/);
 assert.doesNotMatch(html,/100% seguro|certificado|verificado por|avalado por|garantizado/i);
});

test("contact profiles carry owner declaration, not platform-admin proof or DM responsiveness",()=>{
 assert.match(html,/Instagram <span/);
 assert.match(html,/data-channel-review="owner-attested" data-channel-basis="owner-attested"/);
 assert.equal((html.match(/class="contact-primary"/g)||[]).length,1);
 assert.doesNotMatch(html,/Abrir Instagram para conversar|contacto verificado|responderemos en|WhatsApp oficial/i);
 assert.doesNotMatch(html,/<form\b|<input\b/i);
});

test("six-section hierarchy and mobile typography remain after deleting redundant trust ledger",()=>{
 assert.equal((html.match(/<section\b/g)||[]).length,6);
 const s1=html.indexOf('id="vision"'),s2=html.indexOf('id="soluciones"'),s3=html.indexOf('id="ecosistema"');
 assert.ok(0<s1 && s1<s2 && s2<s3);
 assert.match(css,/\.statement-body\{display:grid;grid-template-columns:minmax\(0,1fr\)/);
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(css,/\.statement h2\{font-size:clamp\(31px,9vw,60px\)/);
 assert.doesNotMatch(css,/\.trust-ledger(?:-grid|-item)?\b/);
 for(const id of ["soluciones","ecosistema","negocios"])
  assert.match(html,new RegExp('id="'+id+'" aria-label="[^"]+"'));
});
