import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const doc=readFileSync(root+'/.github/workflows/prime-manual-publish.yml','utf8');
const job=doc.split('  publish-only-after-independent-authorization:')[1]||'';
test('no push/schedule automatic release; PR has offline-only job',()=>{
 assert.match(doc,/on:\n  pull_request:\n  workflow_dispatch:/);
 assert.doesNotMatch(doc,/\n  push:\n|\n  schedule:\n/);
 assert.match(doc,/if: github.event_name == 'pull_request'/);
});
test('manual publishing requires exact sha, main, confirmation and fail-closed approval variables',()=>{
 for(const required of ["github.event_name == 'workflow_dispatch'",
  "github.repository == 'M0-coder/DESSET-prime'",
  "github.ref == 'refs/heads/main'"])assert.ok(job.includes(required),required);
 const dollar=String.fromCharCode(36);
 for(const input of ['RELEASE_SHA: '+dollar+'{{ inputs.release_sha }}',
  'CONFIRM: '+dollar+'{{ inputs.confirmation }}',
  'PREVIOUS_DEPLOYMENT_ID: '+dollar+'{{ inputs.expected_previous_deployment }}'])
  assert.ok(job.includes(input),input);
 for(const field of ['RELEASE_ENABLED','VISUAL_APPROVED_SHA','RIGHTS_APPROVED','CONTACT_APPROVED',
  'SECURITY_APPROVED','ROLLBACK_BACKUP_APPROVED','INDEX_APPROVED'])
  assert.ok(job.includes(field+': '+dollar+'{{ vars.DESSET_PRIME_'+field+' }}'),field);
 assert.ok(job.includes('node scripts/prime-manual-cutover-gate.mjs request'));
});
test('business approvals execute inside the protected job before any Cloudflare credentials',()=>{
 const a=job.indexOf('    if: >-'),b=job.indexOf('    runs-on:',a);
 assert.ok(a>=0&&b>a);
 const guard=job.slice(a,b);
 for(const keyword of ['workflow_dispatch','M0-coder/DESSET-prime','refs/heads/main'])
  assert.ok(guard.includes(keyword));
 for(const forbidden of ['vars.','secrets.','inputs.confirmation','inputs.seo_policy'])
  assert.ok(!guard.includes(forbidden),forbidden);
 const dollar=String.fromCharCode(36);
 const preflight=job.indexOf('node scripts/prime-manual-cutover-gate.mjs request');
 const token=job.indexOf('CLOUDFLARE_API_TOKEN: '+dollar+'{{ secrets.CLOUDFLARE_API_TOKEN }}');
 assert.ok(preflight>=0&&token>preflight);
 assert.match(job,/environment:/);
 assert.match(job,/desset-prime-production/);
});
test('fresh live deployment AND domains are checked twice before one Pages mutation',()=>{
 const before=job.split('      - name: PUBLISH — only mutation')[0];
 assert.equal(before.split('pages/projects/desset-institucional/domains').length-1,2);
 assert.equal(before.split('node scripts/prime-manual-cutover-gate.mjs cloudflare').length-1,2);
 assert.ok(doc.includes('concurrency:'));
 assert.ok(doc.includes('cancel-in-progress: false'));
});
test('environment approval and secrets apply ONLY to manual job',()=>{
 assert.match(job,/environment:\n      name: desset-prime-production/);
 assert.match(job,/CLOUDFLARE_API_TOKEN: \$\{\{ secrets.CLOUDFLARE_API_TOKEN \}\}/);
 const offline=doc.split('  verify-pull-request:')[1].split('  publish-only-after-independent-authorization:')[0];
 assert.doesNotMatch(offline,/secrets\.|pages deploy|wrangler/);
});
test('live Cloudflare state checked twice before the one real Pages mutation',()=>{
 assert.match(job,/prime-manual-cutover-gate.mjs request/);
 assert.match(job,/prime-manual-cutover-gate.mjs cloudflare/g);
 assert.match(job,/Refresh the production deployment ID IMMEDIATELY before mutation/);
 assert.match(job,/--branch=release-approved/);
 assert.match(job,/--commit-hash="\$RELEASE_SHA"/);
 assert.match(job,/--project-name=desset-institucional/);
 const deployLines=job.split("\n").filter(line=>line.includes('wrangler" pages deploy')&&!line.includes("--help"));
 assert.equal(deployLines.length,1,"Exactly one mutation command, excluding --help probe");
});
test('release checks both domains and static security/rollback handling',()=>{
 assert.match(job,/https:\/\/desset\.lat\//);
 assert.match(job,/https:\/\/www\.desset\.lat\//);
 assert.match(job,/content-security-policy:/);
 assert.match(job,/NO automatic rollback/);
 assert.ok(job.includes('INDEX_APPROVED: '+String.fromCharCode(36)+'{{ vars.DESSET_PRIME_INDEX_APPROVED }}'));
});

test('every GitHub expression has both braces and no malformed delimiters',()=>{
 const expressions=[...doc.matchAll(/\$\{\{([^}]+)\}\}/g)];
 assert.ok(expressions.length>=20,'Expected many GitHub expressions in workflow');
 assert.ok(!/\$\{\{[^}\n]+\}(?!\})/.test(doc),'Missing second closing brace in expression');
 assert.ok(!/GH\{/.test(doc),'Unresolved authoring placeholder');
});

test('curl invocations use a single HTTP failure mode supported by the release runner',async(t)=>{
 const commands=job.replace(/\\\n\s*/g,' ').split('\n').filter(line=>/\bcurl\s/.test(line));
 assert.ok(commands.length>0);
 const combinations=new Set();
 for(const line of commands){
  const flags=line.slice(line.indexOf('curl ')+5).trim().split(/\s+/);
  const fail=flags.includes('--fail')||flags.some(flag=>/^-[A-Za-z]+$/.test(flag)&&flag.includes('f'));
  assert.ok(!(fail&&flags.includes('--fail-with-body')),line);
  if(flags.includes('--fail-with-body')){
   const prefix=flags.slice(0,flags.findIndex(flag=>flag==='-H'||flag.includes('https://')));
   combinations.add(prefix.join(' '));
  }
  if(!line.includes("'%{http_code}'"))assert.ok(fail||flags.includes('--fail-with-body'),line);
 }
 assert.ok(combinations.size>0);
 const server=createServer((req,res)=>{
  res.writeHead(req.url==='/ok'?200:404);
  res.end('probe');
 });
 await new Promise((resolve,reject)=>server.once('error',reject).listen(0,'127.0.0.1',resolve));
 t.after(()=>new Promise(resolve=>server.close(resolve)));
 const run=promisify(execFile);
 const base='http://127.0.0.1:'+server.address().port;
 for(const prefix of combinations){
  const args=['--noproxy','*',...prefix.split(' ')];
  assert.equal((await run('curl',[...args,base+'/ok'])).stdout,'probe');
  await assert.rejects(run('curl',[...args,base+'/missing']),{code:22,stdout:'probe'});
 }

});
