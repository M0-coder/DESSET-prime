import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const root=new URL("../",import.meta.url);
const read=x=>readFileSync(new URL(x,root),"utf8");
const ci=read(".github/workflows/preview-checks.yml");
const server=read("scripts/local-preview.mjs");
const lh=read("scripts/lighthouse-summary.mjs");
const mutation=read("scripts/mutation-smoke.mjs");
const staticGate=read("scripts/static-gate.mjs");
test("V5.3 CI uses pinned read-only jobs and no publishing",()=>{
 assert.match(ci,/permissions:\s*\n\s*contents:\s*read/);
 assert.match(ci,/lighthouse-local-lab/);
 assert.match(ci,/npm exec --yes --package=lighthouse@12\.8\.2/);
 assert.match(ci,/node scripts\/static-gate\.mjs/);
 assert.match(ci,/node scripts\/mutation-smoke\.mjs/);
 assert.match(ci,/node --experimental-test-coverage --test/);
 assert.match(ci,/No deployment mechanisms/);
 assert.doesNotMatch(ci,/pages:\s*write|id-token:\s*write|\bwrangler\s+deploy\b|\bvercel\s+deploy\b/);
});
test("V5.3 preview only binds loopback and serves allowlisted local assets",()=>{
 assert.match(server,/const host="127\.0\.0\.1"/);
 assert.match(server,/const port=4173/);
 assert.match(server,/server\.listen\(port,host/);
 assert.match(server,/X-Robots-Tag/);
 assert.match(server,/Content-Security-Policy/);
 assert.match(server,/if\(!permitted\(rel\)\|\|rel\.includes\("\.\."\)/);
 assert.doesNotMatch(server,/0\.0\.0\.0|cloudflare|pages\.dev/);
});
test("V5.3 local Lighthouse is mandatory and failures trip conservative lab budgets",()=>{
 for(const metric of ["largest-contentful-paint","cumulative-layout-shift","total-blocking-time"])assert.ok(lh.includes(metric));
 assert.match(lh,/categories\.performance<85/);
 assert.match(lh,/categories\.accessibility<90/);
 assert.match(lh,/metrics\.cls>0\.1/);
 assert.match(lh,/metrics\.lcp_ms>4000/);
 assert.match(lh,/if\(out\.failures\.length\)process\.exitCode=1/);
 assert.match(lh,/not CrUX, field CWV/);
});
test("V5.3 mutation and static source controls declare constrained scope",()=>{
 for(const word of ["noindex removed","mobile render source removed","reduced motion disabled","remote script injected"])assert.ok(mutation.includes(word));
 assert.match(mutation,/Baseline V5 contract tests fail/);
 assert.match(mutation,/Only four deliberately selected V5 source mutations/);
 assert.match(staticGate,/Nonlocal DOM resource/);
 assert.match(staticGate,/Content-Security-Policy/);
 assert.match(staticGate,/assets_checked/);
 assert.match(staticGate,/not a replacement for SAST, SCA/);
});
