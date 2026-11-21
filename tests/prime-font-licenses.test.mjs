import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,writeFileSync,mkdtempSync,cpSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join,resolve,dirname} from "node:path";
import {fileURLToPath} from "node:url";
import {checkPrimeFonts} from "../scripts/prime-font-licenses.mjs";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"..");
test("Two commercial-use OFL families are pinned to an immutable upstream Git commit",()=>{
 const r=checkPrimeFonts({distDir:join(root,"dist")});
 assert.equal(r.status,"PASS");assert.equal(r.families,2);
 assert.equal(r.license,"SIL-OFL-1.1");assert.equal(r.owner_title,"third-party—not owned by DESSET");
 assert.equal(r.production_authorized,false);
});
function copySite(t){
 const path=mkdtempSync(join(tmpdir(),"desset-font-regression-"));
 t.after(()=>rmSync(path,{recursive:true,force:true}));
 const d=join(path,"dist");cpSync(join(root,"dist"),d,{recursive:true});return d;
}
test("Tampering with any packaged font fails its upstream Git hash check",t=>{
 const d=copySite(t),p=join(d,"fonts/inter-latin-variable.woff2");
 const b=readFileSync(p);b[32]^=1;writeFileSync(p,b);
 assert.throws(()=>checkPrimeFonts({distDir:d}),/FONT RIGHTS NO-GO/);
});
test("Changing a bundled license fails the exact license-content check",t=>{
 const d=copySite(t),p=join(d,"fonts/LICENSE-Plus-Jakarta-Sans-OFL.txt");
 writeFileSync(p,readFileSync(p,"utf8").replace("SIL OPEN FONT LICENSE","CUSTOM LICENSE"));
 assert.throws(()=>checkPrimeFonts({distDir:d}),/FONT RIGHTS NO-GO/);
});
test("Fonts are linked locally and typography never reaches third-party servers",()=>{
 const html=readFileSync(join(root,"index.html"),"utf8"),css=readFileSync(join(root,"styles-typography.css"),"utf8");
 assert.match(html,/rel="preload" href="\.\/fonts\/inter-latin-variable\.woff2"/);
 assert.match(html,/rel="preload" href="\.\/fonts\/plus-jakarta-sans-latin-variable\.woff2"/);
 assert.doesNotMatch(css,/@import|https?:\/\//);
 assert.match(css,/font-weight:100 900/);
 assert.match(css,/font-weight:200 800/);
 assert.match(css,/font-synthesis:none/);
 assert.match(html,/fetchpriority="low"/);
 assert.match(css,/#inicio \.motion-headline/);
});
