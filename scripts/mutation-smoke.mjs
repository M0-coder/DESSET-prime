/** Targeted mutation smoke: mutate real V5 source copies and require actual tests to kill each change. */
import assert from "node:assert/strict";
import {readFileSync,writeFileSync,mkdirSync,cpSync,mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {spawnSync} from "node:child_process";
const root=resolve(fileURLToPath(new URL("../",import.meta.url)));
const files=[
 "index.html","styles-v5.css","scripts/v5-cinematic.js",
 "assets/v5-logistics-scene.svg","assets/v5-logistics-mobile.svg",
 "assets/v5-cinematic-desktop.webp","assets/v5-cinematic-mobile.webp",
 ".github/workflows/preview-checks.yml","tests/v5-cinematic.test.mjs"];
const mutants=[
 {name:"noindex removed",file:"index.html",before:'<meta name="robots" content="noindex,nofollow">',after:'<meta name="robots" content="index,follow">'},
 {name:"mobile render source removed",file:"index.html",before:'srcset="./assets/v5-cinematic-mobile.webp"',after:'srcset="./assets/v5-absent-mobile.webp"'},
 {name:"reduced motion disabled",file:"styles-v5.css",before:'@media(prefers-reduced-motion:reduce) {\n .v5-hero-refraction',after:'@media(prefers-reduced-motion:none) {\n .v5-hero-refraction'},
 {name:"remote script injected",file:"index.html",before:'</head>',after:'<script src="https://untrusted.example/remote.js"></script></head>'}
];
const temp=mkdtempSync(join(tmpdir(),"desset-v53-mutation-"));
const results=[];
function run(){
 return spawnSync(process.execPath,["--test","tests/v5-cinematic.test.mjs"],{
  cwd:temp,encoding:"utf8",timeout:15000,maxBuffer:1e6
 });
}
try{
 for(const file of files){const dst=join(temp,file);mkdirSync(dirname(dst),{recursive:true});cpSync(join(root,file),dst)}
 const baseline=run();
 assert.equal(baseline.status,0,"Baseline V5 contract tests fail: "+String(baseline.stdout).slice(-1800)+String(baseline.stderr).slice(-1800));
 for(const mutant of mutants){
  const path=join(temp,mutant.file),original=readFileSync(path,"utf8");
  assert.equal(original.split(mutant.before).length-1,1,"Expected unique mutation anchor "+mutant.name);
  writeFileSync(path,original.replace(mutant.before,mutant.after));
  const outcome=run();
  const killed=outcome.status!==0&&/# fail [1-9]/.test(String(outcome.stdout));
  results.push({mutant:mutant.name,killed,exitCode:outcome.status});
  writeFileSync(path,original);
  assert.ok(killed,"Mutation survived (or runner failed): "+mutant.name+" "+String(outcome.stdout).slice(-900)+" "+String(outcome.stderr).slice(-300));
 }
}finally{rmSync(temp,{recursive:true,force:true})}
mkdirSync(join(root,"reports","quality"),{recursive:true});
const report={type:"targeted-contract-mutation-smoke",survived:results.filter(x=>!x.killed).length,
 tested:results.length,score:results.filter(x=>x.killed).length/results.length,
 limitations:"Only four deliberately selected V5 source mutations. Not repository-wide mutation coverage.",results};
writeFileSync(join(root,"reports","quality","mutation.json"),JSON.stringify(report,null,2)+"\n");
console.log("DESSET mutation smoke PASS "+results.filter(x=>x.killed).length+"/"+results.length+" targeted mutations killed (not global mutation score)");
