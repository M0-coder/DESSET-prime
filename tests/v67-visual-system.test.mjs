import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";
const root=new URL("../",import.meta.url);
const read=p=>readFileSync(new URL(p,root),"utf8");
const html=read("index.html");
const design=read("styles-system.css");
const base=read("styles.css");
const legacy=read("styles-v5.css");
const build=read("scripts/build-site.mjs");
const preview=read("scripts/local-preview.mjs");
const storyboard=read("scripts/v63-storyboard.mjs");
function token(name){
 const match=design.match(new RegExp("--"+name+":(#[0-9a-fA-F]{6})(?=;|\\s)"));
 assert.ok(match,"Design token missing: "+name);
 return match[1];
}
function luminance(hex){
 const rgb=hex.slice(1).match(/../g).map(h=>parseInt(h,16)/255);
 const linear=rgb.map(x=>x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4));
 return linear[0]*.2126+linear[1]*.7152+linear[2]*.0722;
}
function contrast(a,b){
 const x=luminance(a),y=luminance(b);
 return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);
}

test("V6.7 design system defines 60 neutral / 30 structural / 10 accent roles",()=>{
 assert.equal(token("ds-60-paper").toUpperCase(),"#F7F5EE");
 assert.equal(token("ds-30-blue").toUpperCase(),"#1551D8");
 assert.equal(token("ds-10-gold").toUpperCase(),"#FFC62F");
 assert.equal(token("ds-10-signal").toUpperCase(),"#FF3328");
 for(const label of ["ds-60-surface","ds-30-ink","ds-copy","ds-muted","ds-stroke"])
  assert.match(token(label),/^#[0-9a-fA-F]{6}$/);
 assert.match(design,/60\/30\/10 is a visual-area hierarchy, not a pixel-exact CSS calculation/);
 assert.match(design,/\.contact\s*\{\s*background:var\(--ds-60-paper\)/);
 assert.match(design,/\.solutions-grid \.service--main,\s*\.business-pitch \{background:var\(--ds-30-blue\)/);
 assert.match(design,/\.hero\[data-variant="v4"\] \.hero-cta/);
 assert.match(design,/\.contact-primary\s*\{\s*color:#FFFDF8;background:var\(--ds-30-blue\)/);
 assert.match(design,/@media\(max-width:700px\)/);
 assert.ok(statSync(new URL("styles-system.css",root)).size<9000);
 assert.doesNotMatch(design,/@import\b|url\(\s*['"]?https?:/);
});

test("V6.7 key foregrounds meet WCAG AA contrast for normal text",()=>{
 const samples=[
  ["text on paper",token("ds-copy"),token("ds-60-paper")],
  ["muted on paper",token("ds-muted"),token("ds-60-paper")],
  ["white on royal blue",token("ds-60-surface"),token("ds-30-blue")],
  ["blue contact link on paper",token("ds-30-blue"),token("ds-60-paper")],
  ["ink on yellow CTA",token("ds-30-ink"),token("ds-10-gold")]
 ];
 for(const [name,foreground,background] of samples)
  assert.ok(contrast(foreground,background)>=4.5,
   name+" has insufficient contrast "+contrast(foreground,background).toFixed(2));
});

test("V6.7 updated four-participant ecosystem",()=>{
 assert.ok(html.includes('aria-label="Participantes del modelo de servicios DESSET"'));
 assert.ok(!html.includes('id="ecosystem-title"'));
 const flow=html.match(/<section class="statement" id="vision"[\s\S]*?<\/section>/);
 assert.match(flow?.[0]||"",/<div class="v4-flow motion-story statement-journey"/);
 const scene=html.match(/<section class="ecosystem" id="ecosistema"[\s\S]*?<\/section>/);
 assert.ok(scene&&!scene[0].includes('class="v4-flow motion-story"'),"3D area has no storytelling photo grid");
 assert.ok(flow,"No complete four-participant flow");
 const titles=[...flow[0].matchAll(/<h3>(.*?)<\/h3>/g)].map(x=>x[1]);
 assert.deepEqual(titles,["PROVEEDORES","COMERCIOS","PERSONAS","OPERADORES LOGÍSTICOS"]);
 assert.ok(flow[0].includes("Participantes del modelo de servicios DESSET"));
 assert.ok(!flow[0].includes("ORGANIZAR")&&!flow[0].includes("MOVER"));
 assert.ok(flow[0].includes("Productos y abastecimiento para los negocios."));
 assert.ok(html.includes("las funciones de clientes, comercios, repartidores y control"));
 assert.ok(!html.includes("la arquitectura de Customer, Business, Rider"));
 assert.ok(!storyboard.includes('title:"01 /')&&!storyboard.includes('title:"02 /'));
 assert.ok(storyboard.includes('El servicio todavía no está activo.'));
});

test("V6.7 responsive typography improves legibility without external fonts",()=>{
 assert.match(design,/\.motion-story-unit p \{font-size:clamp\(14px/);
 assert.match(design,/\.v4-architecture-details \.role p \{font-size:14px/);
 assert.match(design,/\.contact-copy \.contact-status \{color:var\(--ds-muted\);font-size:13px/);
 assert.match(design,/@keyframes v45-closing-reveal \{\s*from \{opacity:1;/);
 assert.match(design,/\.contact \.closing-line--middle \{color:var\(--ds-30-blue\)/);
 assert.match(design,/h1,h2,h3,h4 \{text-wrap:balance;\}/);
 assert.match(design,/p \{text-wrap:pretty;\}/);
 assert.match(design,/--ds-radius-compact:12px/);
 assert.match(design,/--ds-radius-surface:18px/);
 assert.match(design,/--ds-radius-feature:26px/);
 assert.doesNotMatch(design,/(?:^|\n)\s*\*\s*\{[^}]*border-radius/);
});

test("V6.7 stylesheet actually loads in the signed site and strict local preview",()=>{
 assert.ok(html.includes('<link rel="stylesheet" href="./styles-system.css">'));
 assert.ok(html.indexOf('href="./styles-system.css"')>html.indexOf('href="./styles-v5.css"'));
 assert.ok(build.includes('"styles-system.css"'));
 assert.ok(build.includes('styles(?:-v5|-system|-hero-photo|-visual02|-typography|-audiences|-prime|-contact|-trust|-news)?'));
 assert.ok(preview.includes('rel==="styles-system.css"'));
 assert.ok(preview.includes('rel==="styles-visual02.css"'));
 assert.ok(preview.includes('rel==="styles-typography.css"'));
 const manifest=JSON.parse(read("dist/site-manifest.json"));
 const record=manifest.files.find(f=>f.path==="styles-system.css");
 assert.ok(record&&record.bytes>4000,"Design CSS absent from signed package");
 assert.equal(read("dist/styles-system.css"),design);
 assert.equal(manifest.domain,"none");
 assert.equal(manifest.noindex,true);
});

test("V6.7 does not invent contact channels, forms or premature operations",()=>{
 assert.equal((html.match(/data-channel-review="owner-attested" data-channel-basis="owner-attested"/g)||[]).length,5);
 assert.doesNotMatch(html,/<form\b|<iframe\b|https?:\/\/(?:wa\.me|api\.whatsapp\.com)/i);
 assert.match(readFileSync(new URL("../empresa.html",import.meta.url),"utf8"),/Este sitio no procesa pedidos ni pagos\./);
 assert.match(readFileSync(new URL("../empresa.html",import.meta.url),"utf8"),/Este sitio no procesa pedidos ni pagos\./);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
});
