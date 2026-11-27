import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const read=p=>readFileSync(new URL(p,import.meta.url),"utf8");
const html=read("../internal/contact-ready/index.html"),js=read("../internal/contact-ready/contact-ready.js"),contract=JSON.parse(read("../internal/contact-ready/readiness.json"));
test("nine fixed categories, all disabled",()=>{assert.equal(contract.categories.length,9);assert.equal(new Set(contract.categories.map(c=>c.id)).size,9);assert.ok(contract.categories.every(c=>c.enabled===false&&c.recipient===null));for(const c of contract.categories)assert.ok(html.includes('href="#consulta-'+c.id+'"'));});
test("closed intake, no transmission or storage",()=>{for(const k of ["intakeEnabled","publicPackage","storageEnabled","notificationsEnabled","productionDeploymentEnabled"])assert.equal(contract[k],false);assert.match(html,/connect-src 'none'; form-action 'none'/);assert.match(html,/name="robots" content="noindex,nofollow"/);assert.match(html,/type="submit" disabled/);assert.doesNotMatch(html,/<(?:input|textarea)[^>]*\bname\s*=/i);assert.doesNotMatch(js,/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie)\b/);assert.match(js,/event.preventDefault\(\)/);assert.match(js,/pagehide/);});
test("not part of public allowlist",()=>{assert.doesNotMatch(read("../scripts/build-site.mjs"),/internal\/contact-ready/);assert.doesNotMatch(read("../contacto.html"),/contact-ready|demo-form/);});
