import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
const source = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const js = readFileSync(new URL("../scripts/app.js", import.meta.url), "utf8");
const mark = readFileSync(new URL("../assets/deliver-assets-mark.png", import.meta.url));
test("Original DESSET symbol is byte-identical to the historically documented Git blob",()=>{
  const h=createHash("sha1").update("blob "+mark.length+"\0").update(mark).digest("hex");
  assert.equal(h, "fa6cb4ea5c5331c4cf47dfd157214e972f809356");
});
test("Site keeps actual symbol local and does not draw an invented mark",()=>{
  assert.match(source,/src="\.\/assets\/deliver-assets-mark\.png"/);
  assert.doesNotMatch(source,/https?:\/\/raw\.githubusercontent\.com/);
});
test("Public assertions are non-transactional and no unsupported benefits are advertised",()=>{
  assert.match(source,/No procesa pedidos ni pagos/);
  assert.match(source,/HORIZONTE/);
  assert.doesNotMatch(source,/>\s*(?:Pedir ahora|Hacer un pedido|Iniciar sesión|Descarga la app)/i);
  assert.doesNotMatch(source,/[+]\s*[0-9]+\s*(?:clientes|repartidores|pedidos|negocios)/i);
});
test("All navigation links resolve and menu is keyboard operable",()=>{
  for(const id of ["inicio","vision","soluciones","ecosistema","contacto"]){
    assert.match(source,new RegExp('id="'+id+'"'));
  }
  assert.match(source,/aria-expanded="false"/);
  assert.match(js,/event\.key === "Escape"/);
});
test("A11y + safe preview controls and reduced motion contract",()=>{
  assert.match(source,/name="robots" content="noindex,nofollow"/);
  assert.match(source,/Content-Security-Policy/);
  assert.match(css,/prefers-reduced-motion:reduce/);
  assert.match(source,/Saltar al contenido/);
  assert.doesNotMatch(source,/<form[\s>]/i);
});
