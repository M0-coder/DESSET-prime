import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";

const root=new URL("../",import.meta.url);
const html=readFileSync(new URL("index.html",root),"utf8");
const css=readFileSync(new URL("styles.css",root),"utf8");

test("V4.3: limited public story, no redundant responsibility section and two short audience choices",()=>{
 const ids=[...html.matchAll(/<section\b[^>]*\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(ids,["inicio","vision","soluciones","ecosistema","negocios"]);
 assert.match(html,/<section class="audiences" id="negocios"[^>]*>\s*<div class="contact" id="contacto"/);
 assert.doesNotMatch(html,/class="responsibility"/);
 assert.doesNotMatch(html,/class="statement-track"/);
 assert.doesNotMatch(css,/\.responsibility(?:\b|-)/);
 const cards=html.match(/<div class="audience-grid audience-grid--compact">([\s\S]*?)<\/div>/);
 assert.ok(cards);
 assert.equal((cards[1].match(/<article class="(?:business-pitch|audience)">/g)||[]).length,2);
 assert.match(cards[1],/<h3>Comercios<\/h3>/);
 assert.match(cards[1],/<h3>Repartidores<\/h3>/);
 assert.doesNotMatch(cards[1],/<h3>Personas|<h3>Aliados|business-pitch-symbol/);
 assert.doesNotMatch(cards[1],/<h3>Negocios\./);
});

test("Two independent visible service brands without implied availability",()=>{
 const services=html.match(/<section class="solutions"[^>]*>([\s\S]*?)<\/section>/)?.[1];
 assert.ok(services);
 assert.doesNotMatch(services,/<h2\b|solutions-title/);
 assert.match(html,/<section class="solutions" id="soluciones" aria-label="Servicios y aplicaciones DESSET">/);
 assert.match(css,/#soluciones \.service \.service-body h3\{[^}]*align-items:center;justify-content:center;text-align:center/);
 assert.match(css,/#soluciones \.service--prime h3 span\{display:block/);
 const cards=[...services.matchAll(/<article class="service service--(main|prime)">([\s\S]*?)<\/article>/g)];
 assert.deepEqual(cards.map(c=>c[1]),["main","prime"]);
 assert.match(cards[0][2],/<h3>DESSET<\/h3>[\s\S]*?<strong>Comercio y delivery<\/strong>/);
 assert.match(cards[1][2],/<h3>DESSET <span>prime<\/span><\/h3>[\s\S]*?<strong>Logística integral<\/strong>/);
 assert.doesNotMatch(services,/<details|service-arrow|future-services|Área complementaria|acceso público disponible|operación comercial activa/i);
 assert.match(css,/#soluciones \.solutions-grid\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:700px\)\{\s*#soluciones \.solutions-grid\{grid-template-columns:minmax\(0,1fr\)/);
});

test("V4.3: hero CTA reaches the unique primary contact path and is accessible",()=>{
 const hero=html.match(/<div class="hero-actions">([\s\S]*?)<\/div>/)?.[1]||"";
 assert.match(hero,/<a class="hero-cta" href="#contacto">Hablemos de tu negocio/);
 assert.doesNotMatch(hero,/hero-secondary|data-v64-tour-launch/);
 assert.equal((hero.match(/<a\b/g)||[]).length,1,"Only one primary hero CTA survives");
 assert.match(html,/class="v63-tour"/);
 assert.match(html,/href="https:\/\/www\.instagram\.com\/deliver_assets\/" data-footer-channel="Instagram"/);
 assert.match(html,/data-footer-channel="Instagram" aria-label="Instagram"/);
 assert.match(css,/a:focus-visible,button:focus-visible/);
 assert.match(css,/\.footer-social a\{[^}]*width:44px;height:44px/);
 assert.doesNotMatch(html,/class="contact-primary"|contact-bottom|social-links--official/);
 assert.equal((html.match(/data-channel-review="owner-attested" data-channel-basis="owner-attested"/g)||[]).length,5,
   "Five DESSET accounts require exact owner attestation; platform admin access remains untested");
 assert.doesNotMatch(html,/<a\b[^>]+href="(?:mailto:|tel:|https:\/\/wa\.me\/)/i);
 assert.match(readFileSync(new URL("../empresa.html",import.meta.url),"utf8"),/Este sitio no procesa pedidos ni pagos\./);
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

test("Public controls have no decorative arrows and partner buttons share one visual contract",()=>{
 for(const m of html.matchAll(/<(a|button|summary)\b[^>]*>([\s\S]*?)<\/\1>/g))assert.doesNotMatch(m[2],/[↗→➜]/);
 assert.match(html,/class="disclosure-indicator"/);
 assert.match(css,/\.v4-architecture-details\[open\] summary \.disclosure-indicator/);
 assert.match(css,/#negocios\.audiences \.audience-grid--compact>article a\{[^}]*background:#1551d8;color:#fff/);
});
