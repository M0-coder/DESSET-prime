import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,statSync} from "node:fs";

const root=new URL("../",import.meta.url);
const read=path=>readFileSync(new URL(path,root),"utf8");
const html=read("index.html");
const css=read("styles.css");
const js=read("scripts/app.js");
const workflow=read(".github/workflows/preview-checks.yml");
const headers=read("_headers");

test("no internal dead links, duplicate anchors or inaccessible unlabelled images",()=>{
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length,"Duplicate DOM ids are prohibited");
 const hrefs=[...html.matchAll(/\bhref="(#[^"]*)"/g)].map(m=>m[1]);
 for(const href of hrefs){
  assert.notEqual(href,"#","Empty anchor");
  assert.ok(ids.includes(href.slice(1)),"Missing target for "+href);
 }
 for(const tag of html.match(/<img\b[^>]*>/g)||[]){
  assert.match(tag,/\balt="/,"All image nodes need explicit alt, including decorative ones");
 }
});

test("external contact links open safely and contain no placeholder destinations",()=>{
 for(const tag of html.match(/<a\b[^>]*>/g)||[]){
  if(/\btarget="_blank"/.test(tag)){
   assert.match(tag,/\brel="[^"]*\bnoopener\b[^"]*\bnoreferrer\b/);
   assert.match(tag,/\bhref="https:\/\//);
  }
  assert.doesNotMatch(tag,/href="(?:#|https?:\/\/(?:example|localhost|test)\.)"/i);
 }
 assert.ok((html.match(/href="https:\/\/(?:www\.instagram\.com|x\.com|www\.facebook\.com)/g)||[]).length>=3);
});

test("preview cannot be published or indexed by code changes to front-end assets",()=>{
 assert.match(html,/<meta name="robots" content="noindex,nofollow">/);
 assert.doesNotMatch(html,/<form\b|<input\b|<script[^>]*src="https?:\/\//i);
 assert.doesNotMatch(html,/iniciar sesión|descarga (?:la|nuestra) app|seguimiento en tiempo real/i);
 assert.match(html,/Acceso público no habilitado/);
 assert.doesNotMatch(html,/prime-photo-caption|Representación conceptual · No corresponde a operaciones activas de DESSET/i);
 assert.match(html,/aria-label="Escena conceptual:/);
 assert.doesNotMatch(html,/v5-stage-caption|motion-story-bridge/);
 assert.doesNotMatch(workflow,/^\s*deploy:\s*$/m);
 assert.match(workflow,/permissions:\s*\n\s*contents:\s*read/);
 assert.match(workflow,/No deployment mechanisms/);
 assert.doesNotMatch(workflow,/^\s*(?:environment:|pages:\s*write|id-token:\s*write|publish-dir:)/m);
 assert.match(headers,/frame-ancestors 'none'/);
 assert.doesNotMatch(headers,/unsafe-inline|unsafe-eval/);
});

test("static payload budgets stay bounded and original design stays local",()=>{
 const max={"index.html":35_000,"styles.css":45_000,"scripts/app.js":8_000};
 for(const [file,limit] of Object.entries(max)){
  assert.ok(statSync(new URL(file,root)).size<=limit,file+" exceeds budget "+limit);
 }
 assert.doesNotMatch(css,/@import\s|url\(\s*["']?https?:\/\//i);
 assert.doesNotMatch(js,/fetch\s*\(|XMLHttpRequest|navigator\.sendBeacon|localStorage/i);
 assert.match(css,/@media\(max-width:360px\)/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
});
