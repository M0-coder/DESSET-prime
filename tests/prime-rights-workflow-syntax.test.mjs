import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const yaml=readFileSync(new URL('../.github/workflows/prime-rights-sbom-no-deploy.yml',import.meta.url),'utf8');
const extractExpressions=(source)=>{
  const openings=[...source.matchAll(/\$\{\{/g)].map(match=>match.index);
  const closings=[...source.matchAll(/\}\}/g)].map(match=>match.index);
  return {openings,closings};
};
const assertBalanced=(source)=>{
  const {openings,closings}=extractExpressions(source);
  assert.equal(openings.length,4,'Must have all four GitHub Actions expressions');
  assert.equal(closings.length,4,'Each GitHub Actions expression must be closed');
  for(let i=0;i<4;i++){
    assert.ok(closings[i]>openings[i],'Closing marker must follow its opening marker');
    assert.ok(i===3||closings[i]<openings[i+1],'Expressions must not overlap');
  }
};
test('rights/SBOM workflow has four fully closed GitHub Expressions',()=>{
  assertBalanced(yaml);
  assert.match(yaml,/ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
  assert.match(yaml,/desset-prime-rights-sbom-NO-GO-\$\{\{ github\.run_id \}\}/);
  assert.match(yaml,/\$\{\{ runner\.temp \}\}\/prime-rights-and-sbom\.json/);
  assert.match(yaml,/\$\{\{ runner\.temp \}\}\/prime-npm-sbom\.spdx\.json/);
});
test('rights/SBOM workflow still remains read-only and never deploys',()=>{
  assert.match(yaml,/permissions:\s*\n  contents: read/);
  assert.match(yaml,/npm sbom --package-lock-only --sbom-format=spdx/);
  assert.match(yaml,/node scripts\/prime-rights-license-audit\.mjs/);
  assert.match(yaml,/npm audit --audit-level=high/);
  assert.doesNotMatch(yaml,/(?:wrangler\s+pages\s+deploy|cloudflare\s+pages\s+deploy|pages:\s*write|CLOUDFLARE_API_TOKEN)/i);
});
test('mutation: each unfinished expression fails the syntax contract',()=>{
  const cases=[
    yaml.replace('github.sha }}','github.sha }'),
    yaml.replace('github.run_id }}','github.run_id }'),
    yaml.replace('runner.temp }}/prime-rights','runner.temp }/prime-rights'),
    yaml.replace('runner.temp }}/prime-npm','runner.temp }/prime-npm'),
  ];
  for(const value of cases)assert.throws(()=>assertBalanced(value),/must be closed|overlap|follow|four/i);
});
