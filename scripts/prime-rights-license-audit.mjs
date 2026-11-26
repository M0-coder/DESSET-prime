/**
 * DESSET Prime asset provenance + third-party license audit.
 * Enforces file integrity and distinguishes owner declaration from independently verified title.
 * OFFLINE, read-only: never establishes legal ownership or authorizes publication.
 */
import {readFileSync,lstatSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,resolve,dirname,isAbsolute} from 'node:path';
import {fileURLToPath} from 'node:url';
import {checkPrimeFonts} from './prime-font-licenses.mjs';
import {reviewSelectedMedia,reviewPrimePageMedia,reviewTalentPhoto,reviewMerchantHeroPhoto,reviewHomeTalentPhoto} from './prime-manual-cutover-gate.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const hash=b=>createHash('sha256').update(b).digest('hex');
const requireSafe=(okay,reason)=>{if(!okay)throw Error('NO-GO: '+reason)};
const isMedia=p=>/^assets\/[a-z0-9-]+\.(?:png|webp|svg|glb)$/.test(p);
export function checkAssetRightsAndLicenses({
  dist,register=JSON.parse(readFileSync(join(root,'config/prime-original-assets.json'),'utf8')),
  lock=JSON.parse(readFileSync(join(root,'package-lock.json'),'utf8')),
  pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'))
}){
 requireSafe(isAbsolute(dist),'dist must be absolute');
 const source=JSON.parse(readFileSync(join(dist,'site-manifest.json'),'utf8'));
 const fontEvidence=checkPrimeFonts({distDir:dist});
 requireSafe(source.schema==='desset-prime-static-web-package-v1'&&source.noindex===true,
  'wrong Prime source package');
 requireSafe(register.schema==='desset-prime-original-assets-v1'&&
   register.source_repository==='M0-coder/DESSET-prime','wrong original assets registry');
 requireSafe(register.assertion?.status==='owner-declared'&&
   register.assertion?.independent_legal_verification===false&&
   register.assertion?.external_chain_of_title==='not_attached',
   'ownership declaration cannot be silently upgraded to legal certification');
 requireSafe(register.excluded_generated_asset==='assets/v6-three.bundle.js'&&
   !register.assets.some(a=>a.path===register.excluded_generated_asset),
   'Three.js bundle is mixed proprietary/third-party code, not a solely owned visual asset');
 const expected=new Map(),declared=new Set(),retired=new Set(["assets/roles-geometry-es.svg","assets/roles-geometry-mobile-es.svg"]),archived=[];
 requireSafe(Array.isArray(register.assets)&&register.assets.length===14,'original media count changed');
 for(const a of register.assets){
  requireSafe(isMedia(a.path)&&/^[a-f0-9]{64}$/.test(a.sha256)&&a.claim==='owner-declared'&&
    !declared.has(a.path),'invalid or duplicated declared media');
  declared.add(a.path);
  if(retired.has(a.path)){
   const historical=readFileSync(join(root,a.path));
   requireSafe(hash(historical)===a.sha256,'modified historical media: '+a.path);
   requireSafe(!source.files.some(f=>f.path===a.path),'retired diagram in release: '+a.path);
   archived.push({path:a.path,sha256:a.sha256,scope:'source-only'});
  }else expected.set(a.path,a.sha256);
 }
 const selected=JSON.parse(readFileSync(join(root,'config/prime-selected-media.json'),'utf8'));
 requireSafe(selected.schema==='desset-prime-selected-media-v1'&&selected.release_authorized===false&&Array.isArray(selected.assets)&&selected.assets.length===4,'invalid selected media inventory');
 const selectedByPath=new Map();
 for(const a of selected.assets){
  requireSafe(/^assets\/ecosistema-[a-z0-9-]+\.webp$/.test(a.path)&&/^[a-f0-9]{64}$/.test(a.sha256)&&Number.isSafeInteger(a.bytes)&&a.bytes>0&&!expected.has(a.path)&&!selectedByPath.has(a.path),'invalid/duplicated selected photograph');
  requireSafe(a.claim==='third-party'||a.claim==='ai-generated-owner-selected','selected media must not be declared exclusive owner property');
  if(a.claim==='third-party')requireSafe(['Pexels License','Unsplash License'].includes(a.license)&&typeof a.source==='string'&&typeof a.license_url==='string'&&['source-identified','individual-source-pending','individual-source-verified'].includes(a.verification),'missing external license record');
  selectedByPath.set(a.path,a);expected.set(a.path,a.sha256);
 }
 requireSafe(selected.assets.filter(a=>a.claim==='third-party').length===3,'expected three externally licensed photographs');
 requireSafe(reviewPrimePageMedia(selected),'invalid Prime page photograph registry');
 const primePageByPath=new Map();
 for(const a of selected.prime_page_assets){
  requireSafe(!expected.has(a.path),'duplicated Prime page photograph');
  primePageByPath.set(a.path,a);expected.set(a.path,a.sha256);
 }
 const talent=selected.talent_photo;
 requireSafe(talent?.path==='assets/talento-cultura.webp'&&talent.claim==='third-party'&&talent.source_id==='4990531'&&talent.license==='Pexels License'&&talent.license_url==='https://www.pexels.com/license/'&&/^[a-f0-9]{64}$/.test(talent.sha256)&&Number.isSafeInteger(talent.bytes)&&talent.bytes>0&&talent.bytes<=230000&&['individual-source-pending','individual-source-verified'].includes(talent.verification)&&talent.release_authorized===false&&!expected.has(talent.path),'invalid talent media registry');
 requireSafe(reviewTalentPhoto(selected).accepted,'talent photo lacks scoped rights review');
 expected.set(talent.path,talent.sha256);
 const homeTalent=selected.home_talent_photo;
 requireSafe(reviewHomeTalentPhoto(selected).accepted&&!expected.has(homeTalent.path),'invalid home talent photo registry');
 expected.set(homeTalent.path,homeTalent.sha256);
 const merchant=selected.merchant_hero_photo;
 requireSafe(reviewMerchantHeroPhoto(selected).accepted&&!expected.has(merchant.path),'invalid merchant hero photo registry');
 expected.set(merchant.path,merchant.sha256);
 const sources=source.files.filter(f=>isMedia(f.path));
 requireSafe(sources.length===expected.size,'unexpected original-media inventory');
 const verified=[],selectedVerified=[],primePageVerified=[];
 for(const entry of sources){
  requireSafe(expected.get(entry.path)===entry.sha256,'unreviewed image or 3D hash: '+entry.path);
  const path=join(dist,entry.path),stat=lstatSync(path);
  requireSafe(stat.isFile()&&!stat.isSymbolicLink(),'invalid original media file: '+entry.path);
  const bytes=readFileSync(path);
  requireSafe(bytes.length===entry.bytes&&hash(bytes)===entry.sha256,'modified original media bytes: '+entry.path);
  const a=selectedByPath.get(entry.path);
  if(a){requireSafe(a.bytes===bytes.length&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP','invalid approved WebP '+entry.path);selectedVerified.push({...a});}
  else if(primePageByPath.has(entry.path)){
   const p=primePageByPath.get(entry.path);
   requireSafe(p.bytes===bytes.length&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP','invalid Prime page WebP '+entry.path);
   primePageVerified.push({...p});
  }
  else if(entry.path===talent.path){requireSafe(bytes.length===talent.bytes&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP','invalid talent WebP');}
  else if(entry.path===homeTalent.path){requireSafe(bytes.length===homeTalent.bytes&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP','invalid home talent WebP');}
  else if(entry.path===merchant.path){requireSafe(bytes.length===merchant.bytes&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP','invalid merchant hero WebP');}
  else verified.push({path:entry.path,bytes:entry.bytes,sha256:entry.sha256,claim:'owner-declared'});
 }
 requireSafe(archived.length===2&&verified.length===12&&verified.every(x=>expected.has(x.path))&&selectedVerified.length===4&&primePageVerified.length===6,'incomplete ownership or selected media registry');
 // SPDX/license metadata is derived from the reproducible npm lock, not from the owner assertion.
 requireSafe(lock.lockfileVersion===3&&pkg.dependencies?.three==='0.187.0'&&
   pkg.devDependencies?.esbuild==='0.28.2','unreviewed package versions');
 requireSafe(lock.packages?.['node_modules/three']?.version==='0.187.0'&&
   lock.packages?.['node_modules/esbuild']?.version==='0.28.2','lockfile is not pinned to validated Three.js/esbuild');
 const packages=[];
 for(const [path,p] of Object.entries(lock.packages)){
  if(!path.startsWith('node_modules/'))continue;
  requireSafe(p.version&&p.license&&p.license==='MIT','review third-party license before release: '+path);
  requireSafe(typeof p.integrity==='string'&&p.integrity.startsWith('sha512-')&&
    typeof p.resolved==='string'&&p.resolved.startsWith('https://registry.npmjs.org/'),
    'untrusted package integrity/registry: '+path);
  packages.push({name:path.slice('node_modules/'.length),version:p.version,
    license:p.license,dev:p.dev===true,optional:p.optional===true,
    integrity:p.integrity});
 }
 requireSafe(packages.length>=2,'third-party SBOM unexpectedly empty');
 requireSafe(packages.some(x=>x.name==='three'&&x.dev===false),'Three.js runtime dependency missing');
 requireSafe(packages.some(x=>x.name==='esbuild'&&x.dev===true),'esbuild build dependency missing');
 requireSafe(source.files.some(x=>x.path==='assets/v6-three.bundle.js'),
   'third-party Three.js bundle missing from website');
 return {schema:'desset-prime-rights-and-sbom-evidence-v1',outcome:'PASS',
  owner_declaration_status:'owner-declared',legal_title_independently_verified:false,
  assets_checked:verified.length,assets:verified,archived_media_checked:archived.length,archived_media:archived,
  merchant_hero_media:{...merchant,individual_source_verified:merchant.verification==='individual-source-verified'},merchant_hero_media_review:reviewMerchantHeroPhoto(selected),
  home_talent_media:{...homeTalent,individual_source_verified:false},home_talent_media_review:reviewHomeTalentPhoto(selected),
  talent_media:{...talent,individual_source_verified:talent.verification==='individual-source-verified'},talent_media_review:reviewTalentPhoto(selected),
  prime_page_media_checked:primePageVerified.length,prime_page_media:primePageVerified,
  selected_media_checked:selectedVerified.length,selected_media:selectedVerified,individual_license_review_complete:selected.individual_license_review_complete===true&&selectedVerified.filter(a=>a.claim==='third-party').every(a=>a.verification==='individual-source-verified'),
  selected_media_review:reviewSelectedMedia(selected),selected_media_owner_attestation:selected.owner_attestation??null,
  third_party_packages:packages.sort((a,b)=>a.name.localeCompare(b.name)),
  compiled_bundle:'assets/v6-three.bundle.js',compiled_bundle_contains_third_party:true,
  fonts_checked:fontEvidence.families,font_license:fontEvidence.license,
  fonts_are_third_party:true,fonts_upstream_commit:fontEvidence.commit,
  note:'Original media ownership was declared by the project owner. Independent assignment/rights proofs are not attached. All npm packages are separately MIT-licensed, while Inter and Plus Jakarta Sans are separately OFL 1.1-licensed; preserve both license files.',
  publication_authorized:false,release_decision:'NO-GO'};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const dist=process.argv[2],outfile=process.argv[3];
  requireSafe(dist&&isAbsolute(dist),'Usage: node scripts/prime-rights-license-audit.mjs /absolute/dist [/absolute/report.json]');
  const result=checkAssetRightsAndLicenses({dist});
  if(outfile){requireSafe(isAbsolute(outfile),'report path must be absolute');const {writeFileSync}=await import('node:fs');
    writeFileSync(outfile,JSON.stringify(result,null,2)+'\n',{flag:'wx'});}
  console.log(JSON.stringify({outcome:result.outcome,assets:result.assets_checked,
    selected_media:result.selected_media_checked,individual_license_review_complete:result.individual_license_review_complete,selected_media_review_basis:result.selected_media_review.basis,packages:result.third_party_packages.length,legal_verification:false,release_decision:'NO-GO'}));
 }catch(e){console.error(e.message);process.exitCode=1;}
}
