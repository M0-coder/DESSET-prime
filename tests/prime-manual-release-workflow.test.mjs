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
test('manual publishing requires exact sha, main, confirmation, and disabled-by-default flag',()=>{
 for(const part of ["github.event_name == 'workflow_dispatch'",
   "github.repository == 'M0-coder/DESSET-prime'",
   "github.ref == 'refs/heads/main'",
   "inputs.confirmation == 'PUBLICAR_PRIME_DESSET'",
   "vars.DESSET_PRIME_RELEASE_ENABLED == 'true'",
   "vars.DESSET_PRIME_VISUAL_APPROVED_SHA == inputs.release_sha",
   "vars.DESSET_PRIME_RIGHTS_APPROVED == 'true'",
   "vars.DESSET_PRIME_CONTACT_APPROVED == 'true'",
   "vars.DESSET_PRIME_SECURITY_APPROVED == 'true'",
   "vars.DESSET_PRIME_ROLLBACK_BACKUP_APPROVED == 'true'"])
   assert.ok(job.includes(part),part);
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
 assert.match(job,/vars\.DESSET_PRIME_INDEX_APPROVED == 'true'/);
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
