/**
 * Deterministic notices derived only from the pinned installed npm packages.
 * Original DESSET Prime media and code remain unchanged; MIT dependencies
 * are not incorrectly claimed as exclusively owned by the company.
 * No external network or publishing capability.
 */
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
const must=(condition,description)=>{if(!condition)throw Error('NO-GO: '+description)};
const packages=[
 {name:'three',version:'0.187.0',file:'node_modules/three/LICENSE',category:'Runtime: Three.js bundled locally in DESSET Prime'},
 {name:'esbuild',version:'0.28.2',file:'node_modules/esbuild/LICENSE.md',category:'Build tooling: esbuild, not deployed as a separate runtime library'}
];

export function generateThirdPartyNotices({sourceRoot=root}={}){
 const pkg=JSON.parse(readFileSync(join(sourceRoot,'package.json'),'utf8'));
 const lock=JSON.parse(readFileSync(join(sourceRoot,'package-lock.json'),'utf8'));
 must(pkg.dependencies?.three==='0.187.0'&&pkg.devDependencies?.esbuild==='0.28.2','unreviewed dependency versions');
 const blocks=['DESSET PRIME — THIRD-PARTY LICENSE NOTICES',
  'This notice accompanies the DESSET Prime static website. Original DESSET branding, photography and models remain separate from third-party software.',
  'The full terms below are reproduced from the pinned installed npm packages.',
  'Third-party font files: Inter (SIL OFL 1.1) and Plus Jakarta Sans (SIL OFL 1.1). Full font license terms and copyright notices are distributed alongside the fonts at fonts/LICENSE-Inter-OFL.txt and fonts/LICENSE-Plus-Jakarta-Sans-OFL.txt. These typefaces are not original DESSET assets.'];
 const info=[];
 for(const spec of packages){
  const locked=lock.packages?.['node_modules/'+spec.name];
  must(locked?.version===spec.version && locked?.license==='MIT',
    'missing/unreviewed MIT metadata for '+spec.name);
  const license=readFileSync(join(sourceRoot,spec.file),'utf8').replace(/\r\n/g,'\n').trim();
  must(license.length>800&&license.includes('Permission is hereby granted')&&
    license.includes('THE SOFTWARE IS PROVIDED')&&/copyright/i.test(license),
    'incomplete license notice for '+spec.name);
  must(!license.includes('\u0000'),'invalid license bytes');
  info.push({package:spec.name,version:spec.version,license:'MIT',
    source:spec.file,sha256:sha256(Buffer.from(license+'\n'))});
  blocks.push('--- '+spec.name+' '+spec.version+' (MIT) ---',spec.category,license);
 }
 const text=blocks.join('\n\n')+'\n';
 must(text.includes('three 0.187.0 (MIT)')&&text.includes('esbuild 0.28.2 (MIT)'),'notice assembly failed');
 return {text,info,sha256:sha256(Buffer.from(text))};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const r=generateThirdPartyNotices();
  console.log(JSON.stringify({packages:r.info,notice_sha256:r.sha256,bytes:Buffer.byteLength(r.text)}));
 }catch(e){console.error(e.message);process.exitCode=1;}
}
