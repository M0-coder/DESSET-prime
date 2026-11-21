import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";

const root=new URL("../",import.meta.url);
const html=readFileSync(new URL("index.html",root),"utf8");
const css=readFileSync(new URL("styles.css",root),"utf8");

test("V4.3: limited public story, no redundant responsibility section and two short audience choices",()=>{
 const ids=[...html.matchAll(/<section\b[^>]*\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(ids,["inicio","vision","soluciones","ecosistema","negocios","contacto"]);
 assert.doesNotMatch(html,/class="responsibility"/);
 assert.doesNotMatch(html,/class="statement-track"/);
 assert.doesNotMatch(css,/\.responsibility(?:\b|-)/);
 const cards=html.match(/<div class="audience-grid audience-grid--compact">([\s\S]*?)<\/div>/);
 assert.ok(cards);
 assert.equal((cards[1].match(/class="audience"/g)||[]).length,2);
 assert.match(cards[1],/<h3>Personas<\/h3>/);
 assert.match(cards[1],/<h3>Aliados<\/h3>/);
 assert.doesNotMatch(cards[1],/<h3>Negocios\./);
});

test("V4.3: delivery first and optional expansion do not compete in initial viewport",()=>{
 const main=html.match(/<div class="solutions-grid">([\s\S]*?)<\/div>/);
 const optional=html.match(/<details class="future-services">([\s\S]*?)<\/details>/);
 assert.ok(main&&optional);
 assert.equal((main[1].match(/class="service service--main"/g)||[]).length,1);
 assert.doesNotMatch(main[1],/acceso público disponible|operación comercial activa/i);
 assert.equal((optional[1].match(/class="service"/g)||[]).length,2);
 assert.match(optional[1],/Área complementaria del modelo logístico/);
 assert.match(css,/\.future-services summary:focus-visible/);
 assert.doesNotMatch(html,/<details class="future-services"\s+open/);
});

test("V4.3: hero CTA reaches the unique primary contact path and is accessible",()=>{
 const hero=html.match(/<div class="hero-actions">([\s\S]*?)<\/div>/)?.[1]||"";
 assert.match(hero,/<a class="hero-cta" href="#contacto">Hablemos de tu negocio/);
 assert.doesNotMatch(hero,/hero-secondary|data-v64-tour-launch/);
 assert.equal((hero.match(/<a\b/g)||[]).length,1,"Only one primary hero CTA survives");
 assert.match(html,/class="v63-tour"/);
 assert.match(html,/class="contact-primary" href="https:\/\/www\.instagram\.com\/deliver_assets\/"/);
 assert.match(html,/Ver perfil en Instagram/);
 assert.match(css,/\.contact-primary:focus-visible/);
 assert.match(css,/\.contact-primary\{[^}]*min-height:56px/s);
 assert.equal((html.match(/class="contact-primary"/g)||[]).length,1);
 assert.equal((html.match(/data-channel-review="verified" data-channel-basis="owner-attested"/g)||[]).length,3,
   "Three DESSET accounts require exact owner attestation; platform admin access remains untested");
 assert.doesNotMatch(html,/<a\b[^>]+href="(?:mailto:|tel:|https:\/\/wa\.me\/)/i);
 assert.match(html,/no procesa pedidos ni pagos/i);
});

test("V4.3: static assets bounded and CSS has no unclosed blocks/comments",()=>{
 assert.ok(statSync(new URL("index.html",root)).size<30000);
 assert.ok(statSync(new URL("styles.css",root)).size<45000);
 assert.ok(statSync(new URL("scripts/motion.js",root)).size<5000);
 let depth=0,comment=false,quote=null;
 for(let i=0;i<css.length;i++){
  const c=css[i],next=css[i+1];
  if(comment){if(c==="*"&&next==="/"){comment=false;i++}continue}
  if(quote){if(c==="\\"){i++;continue}if(c===quote)quote=null;continue}
  if(c==="/"&&next==="*"){comment=true;i++;continue}
  if(c==='"'||c==="'"){quote=c;continue}
  if(c==="{")depth++;
  else if(c==="}"){depth--;assert.ok(depth>=0,"Unexpected closing brace at "+i)}
 }
 assert.equal(depth,0,"Unclosed CSS rule");
 assert.equal(comment,false,"Unclosed CSS comment");
 assert.equal(quote,null,"Unclosed CSS string");
});
