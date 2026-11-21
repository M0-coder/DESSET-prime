import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const txt=readFileSync(resolve(root,'.github/workflows/prime-release-preflight.yml'),'utf8');
test('preflight workflow uses only read permissions and no publishing privileges',()=>{
 assert.match(txt,/permissions:\s*\n  contents: read/);
 assert.doesNotMatch(txt,/\bdeployments:\s*write\b|\bid-token:\s*write\b|\bcontents:\s*write\b/);
 assert.doesNotMatch(txt,/(?:wrangler|cf)\s+pages\s+deploy\b|cloudflare\/wrangler-action/i);
 assert.doesNotMatch(txt,/secrets\s*\.|\$\{\{\s*secrets\b/);
 assert.match(txt,/pull_request:/);
 assert.match(txt,/workflow_dispatch:/);
});
test('preflight workflow checks source SHA before release evidence',()=>{
 assert.match(txt,/git rev-parse HEAD/);
 assert.match(txt,/github\.event\.pull_request\.head\.sha \|\| github\.sha/);
 assert.match(txt,/node scripts\/prime-release-preflight\.mjs/);
 assert.match(txt,/npm audit --omit=dev --audit-level=high/);
 assert.match(txt,/git diff --exit-code/);
});
test('preflight workflow archives bytes but contains no production deployment',()=>{
 assert.match(txt,/actions\/upload-artifact@/);
 assert.match(txt,/prime-prepared-public/);
 assert.doesNotMatch(txt,/environment:\s*\n\s*name:\s*desset-production/);
 assert.doesNotMatch(txt,/pages\.deploy\(/);
});
