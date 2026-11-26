/**
 * DESSET PRIME — release evidence, NOT production publication.
 * Verifies exact Git checkout identity, a pinned Cloudflare recovery baseline,
 * and deterministic two-pass packaging using Prime-only source bytes.
 * This module has NO Cloudflare SDK, HTTP, CLI deployment calls or secrets.
 */
import { readFileSync, writeFileSync, rmSync, mkdirSync, cpSync, existsSync, lstatSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, isAbsolute, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { preparePrimeHosting } from './prime-hosting-candidate.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const defaultTarget = resolve(root, 'config/prime-release-target.json');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const HEX40 = /^[a-f0-9]{40}$/;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const assert = (ok, message) => { if(!ok) throw new Error('NO-GO: ' + message); };

function gitCheckoutSha(directory) {
  return execFileSync('git', ['rev-parse','--verify','HEAD'], {cwd:directory,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
}
function isSafeSourceDir(directory) {return isAbsolute(directory) && !directory.includes('\0');}

export function evaluateReleaseControls({sourceSha, actualGitSha, previousDeploymentId, target}) {
  const failures=[];
  const require=(condition, reason)=>{if(!condition) failures.push(reason)};
  require(HEX40.test(sourceSha),'expected SHA is not 40 lowercase hex characters');
  require(actualGitSha === sourceSha, 'source SHA does not match the checked-out Git commit');
  require(target?.schema==='desset-prime-release-target-v1','unexpected target schema');
  require(target?.repository==='M0-coder/DESSET-prime','not the official Prime repository');
  require(target?.cloudflare_project==='desset-institucional','wrong destination project');
  require(target?.production_branch==='release-approved','wrong Cloudflare production branch');
  require(target?.domain==='desset.lat','unexpected canonical host');
  require(target?.production_deploy_enabled===false,'production release flag must remain false');
  require(target?.requires_fresh_owner_approval===true,'owner-approval policy missing');
  require(UUID.test(previousDeploymentId) && previousDeploymentId===target?.recovery_deployment_id,
    'production recovery deployment differs from frozen baseline; re-audit before any publication');
  return {integrity_controls: failures.length?'FAIL':'PASS', blockers:failures,
    domain:target?.domain, cloudflare_project:target?.cloudflare_project,
    source_sha:sourceSha, previous_deployment_id:previousDeploymentId,
    release_authorized:false, release_decision:'NO-GO'};
}

/** Generates a report in an existing local evidence folder; never writes Git sources. */
export function prepareReleaseEvidence({dist, sourceSha, gitSha, previousDeploymentId,
  target = JSON.parse(readFileSync(defaultTarget,'utf8')), evidenceDir = null,
  artifactDir = null}={}) {
  assert(isSafeSourceDir(dist), 'dist must be an absolute local path');
  assert(!process.env.CF_API_TOKEN && !process.env.CLOUDFLARE_API_TOKEN && !process.env.DESSET_RELEASE_APPROVED,
    'production credentials/approval present in preparation process');
  // Real CI uses the exact checked-out Git commit, not the PR synthetic merge ref.
  const actualGitSha = gitSha ?? gitCheckoutSha(root);
  if(evidenceDir && artifactDir){
    const evidence=resolve(evidenceDir),artifact=resolve(artifactDir);
    assert(evidence!==artifact && !evidence.startsWith(artifact+'/') && !artifact.startsWith(evidence+'/'),
      'evidence and public artifact roots must be separate');
  }
  const controls=evaluateReleaseControls({sourceSha,actualGitSha,previousDeploymentId,target});
  assert(controls.integrity_controls==='PASS',controls.blockers.join('; '));
  const a=preparePrimeHosting({dist,sourceSha,mode:'LOCAL_REHEARSAL_ONLY'});
  let b;
  try {
    b=preparePrimeHosting({dist,sourceSha,mode:'LOCAL_REHEARSAL_ONLY'});
    assert(JSON.stringify(a.report.assets)===JSON.stringify(b.report.assets),'two independent packaging passes yielded different output bytes');
    assert(a.report.source_manifest_sha256===b.report.source_manifest_sha256,'original manifest differs across packaging passes');
    assert(a.report.original_files===82 && a.report.staged_files===85,'unexpected Prime package inventory');
    const packageReport={
      schema:'desset-prime-release-evidence-v1',
      origin_repository:target.repository, origin_sha:sourceSha,
      checkout_sha:actualGitSha, upstream_manifest_sha256:a.report.source_manifest_sha256,
      hash_alg:'sha256', canonical_origin:'https://desset.lat/',
      original_files:a.report.original_files, staged_files:a.report.staged_files,
      staged_total_bytes:a.report.staged_total_bytes,
      artifacts_sha256:sha256(Buffer.from(JSON.stringify(a.report.assets))),
      files:a.report.assets, // independent third-party verifier can now check every byte
      repeated_packaging_identical:true, // two PACKAGE copies, NOT two source compilations
      independently_compiled_twice:false,
      previous_deployment_id:previousDeploymentId,
      cloudflare_project:target.cloudflare_project,production_branch:target.production_branch,
      noindex:true, robots_disallow_all:true,
      publication_checks_pending:[
        'Actual production deployment must be rechecked immediately before release',
        'Owner visual/legal/brand approval by exact release SHA',
        'Verify contact/social ownership and privacy policy',
        'Choose production indexing and canonical/sitemap explicitly',
        'SAST/SCA/SBOM, accessibility and physical mobile acceptance',
        'Separate manual release workflow, environment approval and rollback smoke'
      ],
      release_authorized:false,release_decision:'NO-GO'
    };
    // Optional immutable candidate output; it always retains noindex/Disallow rules.
    // Must be a NEW path: never clobber an existing build, release, or web root.
    if(artifactDir){
      assert(isSafeSourceDir(artifactDir) && !existsSync(artifactDir),'artifact path must be absolute and absent');
      const out=resolve(artifactDir),rootDir=resolve(root),input=resolve(dist);
      assert(out!==rootDir && !out.startsWith(rootDir+'/') && out!==input && !out.startsWith(input+'/'),
        'artifact output cannot be inside source checkout/dist');
      cpSync(a.publicDir,out,{recursive:true,force:false,errorOnExist:true});
      try {
        for(const item of a.report.assets){
          const p=join(out,item.path),st=lstatSync(p),bytes=readFileSync(p);
          assert(st.isFile()&&!st.isSymbolicLink()&&bytes.length===item.bytes&&sha256(bytes)===item.sha256,
            'stored release candidate altered during copy: '+item.path);
        }
      }catch(error){rmSync(out,{recursive:true,force:true});throw error}
    }
    if(evidenceDir){
      assert(isSafeSourceDir(evidenceDir),'evidence directory must be absolute');
      mkdirSync(evidenceDir,{recursive:true});
      writeFileSync(join(evidenceDir,'prime-release-evidence.json'),JSON.stringify(packageReport,null,2)+'\n');
    }
    return packageReport;
  } finally {
    rmSync(a.staging,{recursive:true,force:true});
    if(b) rmSync(b.staging,{recursive:true,force:true});
  }
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const [dist,sourceSha,previousDeploymentId,evidenceDir,artifactDir]=process.argv.slice(2);
    assert(dist && sourceSha && previousDeploymentId && evidenceDir,
      'Usage: node scripts/prime-release-preflight.mjs /abs/dist EXACT_SHA PREVIOUS_CF_DEPLOYMENT_UUID /abs/evidence [/abs/new-candidate-dir]');
    const result=prepareReleaseEvidence({dist,sourceSha,previousDeploymentId,evidenceDir,artifactDir});
    console.log(JSON.stringify(result,null,2));
  } catch(e) { console.error(e.message); process.exitCode=1; }
}
