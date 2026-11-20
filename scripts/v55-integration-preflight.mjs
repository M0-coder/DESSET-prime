/** DESSET V5.5 - deterministic, read-only snapshot and integration parity report.
 * Never calls GitHub, Cloudflare, deploy tools or a public domain.
 * PASS means local parity inspection succeeded. Release readiness stays NO-GO. */
import {createHash} from "node:crypto";
import {readFileSync,statSync,mkdirSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("../",import.meta.url)));
const file=x=>readFileSync(resolve(root,x));
const text=x=>file(x).toString("utf8");
const snap=JSON.parse(text("config/v55-production-snapshot.json"));
const html=text("index.html"),headers=text("_headers");
const test=[],fails=[];
const require=(name,pass,data={})=>{test.push({name,pass:Boolean(pass),...data});if(!pass)fails.push(name)};
const blobSHA=bytes=>createHash("sha1").update("blob "+bytes.length+String.fromCharCode(0)).update(bytes).digest("hex");
const a=snap.official.visual_approval.known_asset_blob_sha1;
for(const [path,want] of Object.entries(a)){
 const got=blobSHA(file(path));
 require("Production-approved original asset unchanged: "+path,got===want,{gitBlobSha1:got,expected:want});
}
require("Prime remains presentation only",/en desarrollo/i.test(html)&&/todavía no realiza pedidos ni entregas comerciales/i.test(html)&&/no procesa pedidos ni pagos/i.test(html));
require("Prime stays noindex",html.includes('name="robots" content="noindex,nofollow"'));
require("Prime continues to prohibit remote scripts",/script-src 'self'/.test(html)&&/script-src 'self'/.test(headers));
require("Production branch and workflow metadata are explicit",snap.official.observed_cloudflare.production_branch==="release-approved"&&snap.official.production_requirements.manual_workflow===".github/workflows/cloudflare-pages-production.yml");
require("Owner approval cannot be implied",snap.prime.approval==="pending"&&snap.official.production_requirements.owner_design_approval_required===true);
require("Channels still flagged pending",((html.match(/data-channel-review="pending"/g)||[]).length)>=3);
require("Release deployment remains absent from Prime workflow",!/(?:wrangler\s+pages\s+deploy|\bvercel\s+deploy\b|\bpages:\s*write\b)/.test(text(".github/workflows/preview-checks.yml")));
require("Current Prime is larger than historical packaging baseline",Object.keys(a).length===2&&statSync(resolve(root,"assets/v5-cinematic-desktop.webp")).size>0&&statSync(resolve(root,"assets/v5-cinematic-mobile.webp")).size>0);
const report={schema:"desset-prime-v55-integration-parity-v1",snapshot_at_local:snap.captured_at_local,
checks:test,failures:fails,source_scope:"Prime working branch, OFFLINE; official production data is a historic snapshot",
unchanged_common_assets:Object.keys(a),official_deployment_snapshot:snap.official.observed_cloudflare,
release_readiness:"NO-GO",reason:"Figma, physical devices, accessibility human review, legal, exact-SHA approval, production packaging and separate release consent are pending",
suggested_next_steps:["confirm latest Cloudflare Pages SHA again immediately before any migration","obtain Figma and brand owner approval",
"open separate authorized change PR in M0-coder/DESSET and satisfy official visual-baseline gate",
"run complete official packaging/CI and independent staged preview","require separate manual release instruction","prepare rollback by exact previous deployment id"],
limitations:["No direct inspection of live HTTP or image pixels","Not a substitution for official production repository's release and visual authorization gates.","Source and snapshot parity only; no Cloudflare data was fetched by this script."]};
mkdirSync(resolve(root,"reports/quality"),{recursive:true});
writeFileSync(resolve(root,"reports/quality/v55-integration-preflight.json"),JSON.stringify(report,null,2)+"\n");
console.log("V5.5 read-only integration preflight: "+(fails.length?"FAIL":"PASS")+" "+(test.length-fails.length)+"/"+test.length+" checks; publishing decision remains "+report.release_readiness);
if(fails.length){console.error(fails.join("\n"));process.exitCode=1}
