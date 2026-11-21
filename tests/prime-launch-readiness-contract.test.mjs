import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const yml=readFileSync(join(root,'.github/workflows/prime-manual-publish.yml'),'utf8');
const offline=yml.split('  verify-pull-request:')[1]?.split('  publish-only-after-independent-authorization:')[0]||'';
const manual=yml.split('  publish-only-after-independent-authorization:')[1]||'';
test('PR stage builds two independent fresh source trees instead of copying dist twice',()=>{
 assert.match(offline,/for n in A B; do/);
 assert.match(offline,/git archive --format=tar HEAD \| tar -xf - -C "\$work"/);
 assert.match(offline,/npm ci --ignore-scripts --no-audit --no-fund/);
 assert.match(offline,/npm run build:site/);
 assert.match(offline,/cmp "\$RUNNER_TEMP\/prime-repro-A\/dist\/site-manifest.json" "\$RUNNER_TEMP\/prime-repro-B\/dist\/site-manifest.json"/);
 assert.match(offline,/source_trees: 2/);
 assert.match(offline,/compilations: 2/);
});
test('review evidence archives licenses, institutional channel status and independent build proof',()=>{
 for(const path of ['prime-npm-sbom.spdx.json','prime-rights-and-sbom.json','prime-channel-readiness.json','prime-two-independent-builds.txt'])
  assert.ok(offline.includes(path),path);
});
test('manual production job cannot ignore unverified channels or missing MIT notice',()=>{
 assert.match(manual,/prime-channel-readiness.mjs.*--require-verified/);
 assert.match(manual,/verify-prime-manual-package.mjs/);
 assert.match(manual,/THIRD-PARTY-NOTICES.txt/);
 assert.match(manual,/--branch=release-approved/);
});
test('pull request stage never publishes or receives Cloudflare credentials',()=>{
 assert.doesNotMatch(offline,/secrets\./);
 assert.doesNotMatch(offline,/pages deploy|CLOUDFLARE_API_TOKEN/);
 assert.match(yml,/if: github.event_name == 'pull_request'/);
 assert.match(yml,/github.event_name == 'workflow_dispatch'/);
 assert.match(yml,/vars.DESSET_PRIME_RELEASE_ENABLED == 'true'/);
});
