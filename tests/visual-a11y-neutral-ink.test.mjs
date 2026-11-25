import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";

const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const html=read("index.html"),system=read("styles-system.css"),
 hero=read("styles-hero-photo.css"),typography=read("styles-typography.css"),
 js=read("scripts/app.js"),audit=read("scripts/browser-audit.mjs"),
 three=read("scripts/v6-three.src.mjs"),mainCss=read("styles.css");

test("VISUAL-A11Y-01 neutral black text does not replace brand blue",()=>{
 assert.match(system,/--ds-30-ink:#111111/);
 assert.match(hero,/#inicio \.v4-headline-a\{color:#111111\}/);
 assert.match(hero,/#inicio \.hero-lead\{color:#333333/);
 assert.match(typography,/#vision\.statement\{background:#f4f8fe;color:#111111\}/);
 assert.match(mainCss,/--blue:#1551D8/);
 assert.match(hero,/#inicio \.v4-headline-b\{color:#1551d8\}/);
 assert.match(hero,/background:#1551d8;color:#fff/);
 assert.match(system,/\.site-footer>span,\.site-footer>p\{color:#343434\}/);
});
test("VISUAL-A11Y-01 no cropped DESSET service band at wide viewports",()=>{
 assert.match(hero,/left:50%;width:100vw;transform:translateX\(-50%\);margin:0/);
 assert.doesNotMatch(mainCss,/\.v4-hero-rail\{animation:v4-rail-enter/,"Banner must not be masked while loading");
 assert.match(audit,/diag\.railDisplay\.left< -16/);
 assert.match(audit,/diag\.railDisplay\.right<diag\.railDisplay\.viewportRight-2/);
 assert.match(audit,/diag\.railDisplay\.right>diag\.railDisplay\.viewportRight\+16/);
 assert.match(html,/class="v4-hero-rail" role="list"/);
 assert.equal((html.match(/class="v4-rail-item" role="listitem"/g)||[]).length,4);
});
test("VISUAL-A11Y-01 legible text and accessible mobile menu without breaking interaction",()=>{
 assert.match(typography,/letter-spacing:-\.025em/);
 assert.match(typography,/@media\(max-width:700px\)\{#inicio \.motion-headline\{font-size:clamp\(22px,8\.6cqw,68px\)/);
 assert.match(html,/aria-label="Menú — abrir navegación"/);
 assert.match(js,/open\?"Menú — cerrar navegación":"Menú — abrir navegación"/);
 assert.match(audit,/Mobile menu accessible name must include visible Menú label/);
 assert.match(three,/buildOperationalFleet\(\)/);
 assert.match(html,/name="robots" content="noindex,nofollow"/);
 for(const [path,max] of [["styles-v5.css",16000],["styles-hero-photo.css",9500],["styles-system.css",10000],["styles-typography.css",2800]])
  assert.ok(statSync(new URL("../"+path,import.meta.url)).size<=max,path+" exceeds CSS budget");
});
