import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync,mkdirSync,cpSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {generateThirdPartyNotices} from '../scripts/prime-third-party-notices.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
function fixture(t){
 const p=mkdtempSync(join(tmpdir(),'prime-license-provenance-'));t.after(()=>rmSync(p,{recursive:true,force:true}));
 for(const name of ['package.json','package-lock.json'])cpSync(join(root,name),join(p,name));
 for(const [name,file] of [['three','LICENSE'],['esbuild','LICENSE.md']]){
  const dest=join(p,'node_modules',name);mkdirSync(dest,{recursive:true});
  cpSync(join(root,'node_modules',name,file),join(dest,file));
 }
 return p;
}
test('Two installed MIT license texts are complete, deterministic and separately attributed',()=>{
 const a=generateThirdPartyNotices(),b=generateThirdPartyNotices();
 assert.equal(a.text,b.text);assert.equal(a.sha256,b.sha256);
 assert.equal(a.info.length,2);
 assert.equal((a.text.match(/Permission is hereby granted/g)||[]).length,2);
 for(const p of a.info)assert.equal(p.license,'MIT');
 assert.match(a.text,/Original DESSET branding, photography and models remain separate/);
});
test('A falsified external license is rejected',t=>{
 const p=fixture(t);
 writeFileSync(join(p,'node_modules','three','LICENSE'),'PROPRIETARY');
 assert.throws(()=>generateThirdPartyNotices({sourceRoot:p}),/NO-GO/);
});
test('Changing source dependency version is rejected',t=>{
 const p=fixture(t),file=join(p,'package.json');
 const json=JSON.parse(readFileSync(file,'utf8'));json.dependencies.three='0.188.0';
 writeFileSync(file,JSON.stringify(json));
 assert.throws(()=>generateThirdPartyNotices({sourceRoot:p}),/NO-GO/);
});
test('Dropping one installed full license blocks publication package generation',t=>{
 const p=fixture(t);
 writeFileSync(join(p,'node_modules','esbuild','LICENSE.md'),'');
 assert.throws(()=>generateThirdPartyNotices({sourceRoot:p}),/NO-GO/);
});
