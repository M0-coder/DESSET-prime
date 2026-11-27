import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const read=p=>readFileSync(new URL("../"+p,import.meta.url));
const approved={
  "aplicaciones-clientes.html": "9bc2d4b4634fcdc5cd7de21580f53631052d9b03",
  "aplicaciones-comercios.html": "ea71ad8fd7f36a41bc9e87129a01d2e21fe22bdd",
  "aplicaciones-repartidores.html": "c6899ff1771948abb63e14a768c61b8e87cc7918",
  "aplicaciones.html": "06081d086a83af13b59e9ff6dd3d39e6d5bbc4a8",
  "capacitacion-repartidores.html": "c1b536785ed0b7303f76e40f05eb95d7e081c872",
  "confianza.html": "9c3947d3df2da1c66505fc5841d43d99b8ca0a8f",
  "historia.html": "47f0a2bf36e47c9a9cea1d98d0ea446c0812eeae",
  "incorporacion-comercios.html": "a64809c03ff4cdb8ee7b98618cf8b84a45562e71",
  "incorporacion-repartidores.html": "3b19918a59579fc9d52eff343db46fdde4c48fde",
  "noticias.html": "df5e11721bcfec864c7591a48218a6ebe4ad29d4",
  "perfil-corporativo.html": "0f34adb1a50c9b32e71e139046f28afacc5ba2f4",
  "prime.html": "1b5cd70582402a03eeda44fb9e5c07100e97b6e0",
  "registro-comercios.html": "9944f53964637ed2704c339856b00db9385c7939",
  "registro-repartidores.html": "af11c9a535bbefed166849db437f4d7470df5700"
};
for(const dir of ["","dist/"])test("EDITORIAL-CLEAN-01 exact approved deletions, unchanged profile and remaining content "+(dir||"source"),()=>{
 for(const [page,expected] of Object.entries(approved)){
  const bytes=read(dir+page);
  const sha=createHash("sha1").update("blob "+bytes.length+"\0").update(bytes).digest("hex");
  assert.equal(sha,expected,"Editorial scope changed in "+page+"; explicitly review any future edits");
  const html=bytes.toString();
  assert.match(html,/name="robots" content="noindex,nofollow"/);
  if(page!=="perfil-corporativo.html")assert.doesNotMatch(html,/<p class="(?:apps-kicker|tr-kicker|nw-kicker|history-kicker|ob-kicker|pr-kicker)">/);
 }
 const profile=read(dir+"perfil-corporativo.html").toString();
 assert.ok(profile.includes('<p class="cp-label">COMERCIO Y TECNOLOGÍA</p>'));
 assert.ok(profile.includes('<p class="cp-label">LOGÍSTICA Y DISTRIBUCIÓN</p>'));
 assert.ok(read(dir+"prime.html").toString().includes("Nuestra visión de largo plazo contempla redes logísticas nacionales e internacionales."));
});
