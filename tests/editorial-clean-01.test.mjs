import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash} from "node:crypto";
const read=p=>readFileSync(new URL("../"+p,import.meta.url));
// Candidate #142: exact text-only changes reviewed against prior blobs. Owner approval remains pending.
const approved={
  "aplicaciones-clientes.html": "276cd3984b871a3dff961ca561050d65765b94cd",
  "aplicaciones-comercios.html": "721c447cfd7bb577311e0012afc1666a0ce6c7f2",
  "aplicaciones-repartidores.html": "c6899ff1771948abb63e14a768c61b8e87cc7918",
  "aplicaciones.html": "2bbf4f51efde08229451393145240611200875f9",
  "capacitacion-repartidores.html": "c1b536785ed0b7303f76e40f05eb95d7e081c872",
  "confianza.html": "9c3947d3df2da1c66505fc5841d43d99b8ca0a8f",
  "historia.html": "47f0a2bf36e47c9a9cea1d98d0ea446c0812eeae",
  "incorporacion-comercios.html": "a64809c03ff4cdb8ee7b98618cf8b84a45562e71",
  "incorporacion-repartidores.html": "3b19918a59579fc9d52eff343db46fdde4c48fde",
  "noticias.html": "df5e11721bcfec864c7591a48218a6ebe4ad29d4",
  "perfil-corporativo.html": "0f34adb1a50c9b32e71e139046f28afacc5ba2f4",
  "prime.html": "1b5cd70582402a03eeda44fb9e5c07100e97b6e0",
  "registro-comercios.html": "846c1dd2fce03dcbc792cd3d4da7e0ac7a7430f1",
  "registro-repartidores.html": "134666efb48316f478b63e5396f274fd144160c9"
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
