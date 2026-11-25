import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const base=new URL("../",import.meta.url);
const read=p=>readFileSync(new URL(p,base),"utf8");
const snap=JSON.parse(read("config/v55-production-snapshot.json"));
const doc=read("docs/V5.5-MIGRATION-PREFLIGHT.md");
const app=read("scripts/v55-integration-preflight.mjs");
const ci=read(".github/workflows/preview-checks.yml");
test("V5.5 retains the immutable official production snapshot and rejects automatic approval",()=>{
 assert.equal(snap.schema,"desset-prime-v55-readonly-production-preflight-v1");
 assert.equal(snap.mode,"READ_ONLY_SNAPSHOT_NO_DEPLOY");
 assert.equal(snap.prime.approval,"pending");
 assert.equal(snap.official.repository,"M0-coder/DESSET");
 assert.equal(snap.official.observed_cloudflare.project,"desset-institucional");
 assert.equal(snap.official.observed_cloudflare.production_branch,"release-approved");
 assert.equal(snap.official.observed_cloudflare.commit,"9f48d62cdadb43135fc9c2072cdc9e31f695c9ab");
 assert.equal(snap.official.production_requirements.release_file_count_baseline,13);
 assert.equal(snap.official.production_requirements.manual_workflow,".github/workflows/cloudflare-pages-production.yml");
 assert.equal(snap.official.production_requirements.owner_design_approval_required,true);
 assert.equal(snap.official.production_requirements.main_only,true);
});
test("V5.5 checks exact matching logo and roles assets using Git blob hashing",()=>{
 assert.equal(snap.official.visual_approval.known_asset_blob_sha1["assets/deliver-assets-mark.png"],"fa6cb4ea5c5331c4cf47dfd157214e972f809356");
 assert.equal(snap.official.visual_approval.known_asset_blob_sha1["assets/roles-geometry-v2.svg"],"71401c4d0f93eeefcde393f18e82e165e50d8f90");
 assert.match(app,/String\.fromCharCode\(0\)/);
 assert.match(app,/createHash\("sha1"\)/);
 assert.match(app,/release_readiness:"NO-GO"/);
 assert.match(app,/prime\.approval==="pending"/);
 assert.doesNotMatch(app,/cloudflare\.request\s*\(|fetch\s*\(|wrangler\s+pages\s+deploy/);
});
test("V5.5 migration must target official repo's security gates and require separate release",()=>{
 for(const item of ["M0-coder/DESSET-prime","M0-coder/DESSET","Figma","config/visual-baseline-approved.json",
 ".github/workflows/cloudflare-pages-production.yml","PUBLICAR_DESSET","VISUAL-CHANGE-01.md",
 "13 archivos","rollback","NO-GO","SIN DESPLIEGUE"])
   assert.ok(doc.includes(item),"Missing integration or NO-GO requirement: "+item);
 assert.match(doc,/SHA256 del manifiesto propuesto/);
 assert.match(doc,/workflow_dispatch/);
 assert.match(ci,/node --check scripts\/v55-integration-preflight\.mjs/);
 assert.match(ci,/node scripts\/v55-integration-preflight\.mjs/);
 assert.match(ci,/permissions:\s*\n\s*contents:\s*read/);
 assert.doesNotMatch(ci,/pages:\s*write|id-token:\s*write/);
});

test("V5.5 checks the canonical closed distribution, not the retired controller string",()=>{
 assert.match(app,/assertClosedDistribution\(availability,JSON\.parse\(text\("config\/app-distribution\.json"\)\)\)/);
 assert.match(app,/distributionClosed&&/);
 assert.doesNotMatch(app,/applicationDistribution:"not_published"/);
});
