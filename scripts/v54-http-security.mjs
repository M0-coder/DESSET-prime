/** V5.4: loopback-only HTTP and preview security regression audit.
 * CI evidence, not a penetration test or live-site verification. */
import {spawn} from "node:child_process";
import {readFile, mkdir, writeFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import {resolve} from "node:path";
const host="http://127.0.0.1:4173";
const child=spawn(process.execPath,[fileURLToPath(new URL("./local-preview.mjs",import.meta.url))],{
 stdio:["ignore","pipe","pipe"],env:{...process.env}
});
let output="";
child.stdout.on("data",data=>{output+=String(data).slice(-1500)});
child.stderr.on("data",data=>{output+=String(data).slice(-1500)});
const results=[];
const failures=[];
const record=(label,ok,data={})=>{
 results.push({label,pass:Boolean(ok),...data});
 if(!ok)failures.push(label);
};
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function check(){
 let ready=false;
 for(let attempt=0;attempt<60;attempt++){
  if(child.exitCode!==null)break;
  try{const r=await fetch(host+"/",{signal:AbortSignal.timeout(1300)});if(r.status===200){ready=true;break}}catch{}
  await sleep(100);
 }
 record("Loopback preview serves index",ready);
 if(!ready)return;
 const page=await fetch(host+"/",{signal:AbortSignal.timeout(5000)});
 const html=await page.text();
 const headers=page.headers;
 record("HTTP 200 and HTML content type",page.status===200&&headers.get("content-type")?.startsWith("text/html"));
 record("Noindex HTTP response",headers.get("x-robots-tag")==="noindex, nofollow");
 record("CSP blocks external scripts, objects, frames",["default-src 'self'","script-src 'self'","object-src 'none'","frame-ancestors 'none'"].every(x=>headers.get("content-security-policy")?.includes(x)));
 record("Browser security headers",headers.get("x-content-type-options")==="nosniff"&&headers.get("referrer-policy")==="no-referrer");
 record("No cache for CI-only preview",headers.get("cache-control")==="no-store");
 record("HTML noindex and accessible image-free 3D fallback",html.includes('name="robots" content="noindex,nofollow"')&&html.includes('class="v6-static-fallback"')&&!html.includes("v5-cinematic-"));
 const head=await fetch(host+"/assets/v62-courier.glb",{method:"HEAD",signal:AbortSignal.timeout(5000)});
 record("HEAD original 3D GLB asset",head.status===200&&head.headers.get("content-type")==="model/gltf-binary"&&Number(head.headers.get("content-length"))>100000);
 for(const name of ["inter-latin-variable","plus-jakarta-sans-latin-variable"]){
  const font=await fetch(host+"/fonts/"+name+".woff2",{signal:AbortSignal.timeout(5000)});
  const signature=font.status===200?(await font.arrayBuffer()).slice(0,4):new ArrayBuffer(0);
  record("Locally served WOFF2 "+name,font.status===200&&font.headers.get("content-type")?.startsWith("font/woff2")&&Buffer.from(signature).toString()==="wOF2");
 }
 const css=await fetch(host+"/styles-v5.css",{signal:AbortSignal.timeout(5000)});
 record("CSS served with correct MIME",css.status===200&&css.headers.get("content-type")?.startsWith("text/css"));
 const blocked=["/.git/config","/.github/workflows/preview-checks.yml","/scripts/local-preview.mjs","/docs/V5.3-RELEASE-GATE.md","/%2e%2e/%2e%2e/secret.env","/package.json"];
 for(const path of blocked){
  const resp=await fetch(host+path,{signal:AbortSignal.timeout(5000)});
  record("Forbidden route "+path,resp.status===404);
 }
 const post=await fetch(host+"/",{method:"POST",body:"x",signal:AbortSignal.timeout(5000)});
 record("POST rejected",post.status===405);
 const allowed=await fetch(host+"/scripts/v5-cinematic.js",{signal:AbortSignal.timeout(5000)});
 record("Only public source JS is accessible",allowed.status===200&&allowed.headers.get("content-type")?.startsWith("text/javascript"));
}
try{await check()}
catch(e){failures.push("Runner: "+String(e));results.push({label:"Runner",pass:false,error:String(e)})}
finally{
 child.kill("SIGTERM");
 await sleep(100);
 if(child.exitCode===null)child.kill("SIGKILL");
}
const report={scope:"CI loopback preview only, NOT production",pass:failures.length===0,checks:results.length,results,failures,serverLog:output.slice(-1200),
 limitations:"No live DNS/CDN/Cloudflare inspection, not exhaustive SAST, DAST or third-party dependency audit."};
await mkdir(resolve("reports/quality"),{recursive:true});
await writeFile(resolve("reports/quality","v54-http-security.json"),JSON.stringify(report,null,2)+"\n");
console.log("V5.4 HTTP security audit: "+(report.pass?"PASS":"FAIL")+" "+(results.length-failures.length)+"/"+results.length);
if(failures.length){console.error(failures.join("\n"));process.exitCode=1}
