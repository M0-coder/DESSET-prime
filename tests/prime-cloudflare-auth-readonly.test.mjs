import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const workflow=readFileSync(root+'/.github/workflows/prime-cloudflare-auth-readonly.yml','utf8');

test('credential check is deliberately manual on main of the official repository only',()=>{
  assert.match(workflow,/^on:\n  workflow_dispatch:\n/m);
  assert.doesNotMatch(workflow,/^\s+(push|pull_request|schedule|workflow_run|repository_dispatch):/m);
  assert.match(workflow,/github\.event_name == 'workflow_dispatch'/);
  assert.match(workflow,/github\.repository == 'M0-coder\/DESSET-prime'/);
  assert.match(workflow,/github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow,/^permissions: \{\}$/m);
});

test('environment-scoped secret is read without checkout or repository write permission',()=>{
  assert.match(workflow,/environment:\n      name: desset-prime-production/);
  assert.match(workflow,/CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/);
  assert.match(workflow,/CLOUDFLARE_ACCOUNT_ID: \$\{\{ vars\.DESSET_CF_ACCOUNT_ID \}\}/);
  assert.doesNotMatch(workflow,/uses:\s*actions\/checkout|upload-artifact|actions\/setup-node/);
  assert.doesNotMatch(workflow,/set -x|\beval\b/);
});

test('only two explicitly read-only Cloudflare HTTPS API calls are possible',()=>{
  assert.equal((workflow.match(/\bcurl --silent --show-error/g)||[]).length,2);
  assert.equal((workflow.match(/--request GET/g)||[]).length,2);
  assert.equal((workflow.match(/https:\/\/api\.cloudflare\.com\/client\/v4\/accounts/g)||[]).length,2);
  assert.ok(workflow.includes('pages/projects/desset-institucional")'));
  assert.ok(workflow.includes('pages/projects/desset-institucional/domains")'));
  assert.doesNotMatch(workflow,/--request\s+(POST|PUT|PATCH|DELETE)|-X\s*(POST|PUT|PATCH|DELETE)/);
  assert.doesNotMatch(workflow,/pages deploy|wrangler|\bdeployments\/.*\/rollback|\/retry\b|curl[^\n]*--data|\bgh api\b|\bnpm\b/);
});

test('HTTP success and both active domains are necessary for diagnostic PASS',()=>{
  assert.match(workflow,/project_status.*!= "200"/);
  assert.match(workflow,/domains_status.*!= "200"/);
  assert.match(workflow,/\.success == true/);
  assert.match(workflow,/\.result\.name == "desset-institucional"/);
  assert.match(workflow,/\.result\.production_branch == "release-approved"/);
  assert.match(workflow,/\.name == "desset.lat" and \.status == "active"/);
  assert.match(workflow,/\.name == "www.desset.lat" and \.status == "active"/);
  assert.match(workflow,/DESSET_CLOUDFLARE_AUTH_READONLY_PASS/);
});

test('no release SHA, publish form or output that reveals token material',()=>{
  assert.doesNotMatch(workflow,/release_sha|expected_previous_deployment|pages deploy|github\.event_name == 'pull_request'/);
  assert.doesNotMatch(workflow,/echo[^\n]*\$CLOUDFLARE_API_TOKEN|printf[^\n]*\$CLOUDFLARE_API_TOKEN/);
  assert.doesNotMatch(workflow,/cat\s+.*(project|domains)\.json/);
});
