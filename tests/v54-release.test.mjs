import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const base=new URL("../",import.meta.url);
const read=path=>readFileSync(new URL(path,base),"utf8");
const css=read("styles-v5.css");
const html=read("index.html");
const browser=read("scripts/browser-audit.mjs");
const server=read("scripts/local-preview.mjs");
const audit=read("scripts/v54-http-security.mjs");
const workflow=read(".github/workflows/preview-checks.yml");
const plan=read("docs/V5.4-RELEASE-RUNBOOK.md");

test("V5.4 keyboard landmarks and visible focus have source contracts",()=>{
 assert.match(html,/class="skip-link" href="#contenido"/);
 assert.match(html,/<main id="contenido">/);
 assert.match(html,/aria-controls="main-nav" aria-expanded="false"/);
 assert.match(html,/class="v4-architecture-details"/);
 assert.match(css,/\.menu-button:focus-visible/);
 assert.match(css,/\.future-services summary:focus-visible/);
 assert.match(css,/\.v4-architecture-details summary:focus-visible/);
 assert.match(browser,/Input\.dispatchKeyEvent/);
 for(const phrase of ["V5.4 keyboard first-Tab skip-link","V5.4 keyboard menu Enter and Escape",
    "V5.4 native keyboard disclosure","V5.4 Chromium accessibility tree structural smoke"])
  assert.ok(browser.includes(phrase),"Missing browser evidence: "+phrase);
});

test("V5.4 local HTTP DAST smoke is restricted and cannot become a public server",()=>{
 assert.match(audit,/const host="http:\/\/127\.0\.0\.1:4173"/);
 assert.match(server,/const host="127\.0\.0\.1"/);
 for(const expected of ["x-robots-tag","content-security-policy","x-content-type-options",
    "forbidden route","post rejected","head webp asset"])assert.ok(audit.toLowerCase().includes(expected));
 assert.match(audit,/reports\/quality/);
 assert.match(audit,/if\(failures\.length\)/);
 assert.doesNotMatch(audit,/http:\/\/(?:0\.0\.0\.0|localhost\.localdomain)|https:\/\/desset\.lat/);
});

test("V5.4 CI preserves no-deploy guard and asserts security and keyboard evidence",()=>{
 assert.match(workflow,/permissions:\s*\n\s*contents:\s*read/);
 assert.match(workflow,/node scripts\/v54-http-security\.mjs/);
 assert.match(workflow,/node --check scripts\/v54-http-security\.mjs/);
 assert.match(workflow,/node scripts\/browser-audit\.mjs/);
 assert.match(workflow,/No deployment mechanisms/);
 assert.doesNotMatch(workflow,/pages:\s*write|id-token:\s*write|wrangler deploy|vercel deploy/);
});

test("V5.4 rollback and human gates cannot be misread as authorization",()=>{
 for(const requirement of ["Figma","lectores de pantalla","400 %","móviles físicos","INP","marca",
    "evidencia por SHA","rollback","SIN MERGE","SIN DESPLIEGUE","NO-GO"])
   assert.ok(plan.toLowerCase().includes(requirement.toLowerCase()),"Missing mandatory release blocker: "+requirement);
 assert.match(plan,/requiere una autorización nueva y explícita/i);
});
