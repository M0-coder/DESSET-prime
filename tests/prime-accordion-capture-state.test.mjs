import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const html=read("index.html"),audit=read("scripts/browser-audit.mjs");
test("Both native details start closed on desktop and mobile without JS or CSS hacks",()=>{
 for(const className of ["v4-architecture-details","future-services"]){
  const tag=html.match(new RegExp('<details class="'+className+'"[^>]*>'))?.[0];
  assert.ok(tag,"Missing native details: "+className);
  assert.doesNotMatch(tag,/\sopen(?:\s|=|>)/i,"Disclosure must not auto-open: "+className);
 }
 for(const source of ["scripts/app.js","scripts/v5-cinematic.js","scripts/motion.js"]){
  assert.doesNotMatch(read(source),/\.v4-architecture-details[\s\S]{0,100}\.open\s*=\s*true|\.future-services[\s\S]{0,100}\.open\s*=\s*true/);
 }
});
test("Mobile browser QA opens the technical panel to verify the diagram, then explicitly closes it before full-page screenshots",()=>{
 const opened=audit.indexOf('capture("mobile-architecture-expanded.png")');
 const restored=audit.indexOf('Technical details remained expanded after mobile accordion test');
 const full390=audit.indexOf('capture("mobile-full.png",true)');
 const full320=audit.indexOf('capture("mobile-320-full.png",true)');
 assert.ok(opened>=0&&restored>opened&&full390>restored&&full320>full390);
 assert.match(audit,/390px full-page capture defaults both disclosures CLOSED/);
 assert.match(audit,/320px full-page capture defaults both disclosures CLOSED/);
 assert.match(audit,/Freshly navigated page must start with both native disclosures CLOSED/);
 assert.match(audit,/Optional services disclosure restored to native closed state/);
});
test("The technical accordion remains keyboard-accessible and expandable on demand",()=>{
 assert.match(html,/<details class="v4-architecture-details">\s*<summary>/);
 assert.match(audit,/V5\.4 native keyboard disclosure/);
 assert.match(audit,/Mobile technical accordion restored closed after testing/);
 assert.match(audit,/mobile-architecture-expanded\.png/);
});
