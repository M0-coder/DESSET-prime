/** Static source and asset integrity scanner: deliberately not a full SAST/SCA tool. */
import {readFileSync,existsSync,statSync,mkdirSync,writeFileSync} from "node:fs";
import {resolve} from "node:path";
import {fileURLToPath} from "node:url";
const root=resolve(fileURLToPath(new URL("../",import.meta.url)));
const read=p=>readFileSync(resolve(root,p),"utf8");
const html=read("index.html");
const headers=read("_headers");
const js=["scripts/app.js","scripts/motion.js","scripts/v5-cinematic.js","scripts/service-state.js"].map(read);
const styles=["styles.css","styles-v5.css","styles-system.css","styles-hero-photo.css","styles-visual02.css"].map(read);
const issues=[],warnings=[];
const assert=(ok,label)=>{if(!ok)issues.push(label)};
const localSet=new Set();
for(const tag of html.match(/<(?:script|link|img|source)\b[^>]*>/g)||[]){
 const attrs=[...tag.matchAll(/\b(?:src|href|srcset)="([^"]+)"/g)].map(m=>m[1]);
 for(const val of attrs){
  if(!val.startsWith("./")){issues.push("Nonlocal DOM resource "+val);continue}
  const filename=val.slice(2);
  if(filename.includes("..")||filename.startsWith("/")){issues.push("Unsafe asset path "+filename);continue}
  // Match the single exact, explicitly approved local cache-version alias.
  // Reject any other query string without weakening the file allowlist.
  const localFile=filename==="styles-hero-photo.css?v=hero-fit-03"?"styles-hero-photo.css":filename;
  if(localFile.includes("?")){issues.push("Disallowed resource query: "+filename);continue}
  const full=resolve(root,localFile);
  assert(existsSync(full),"Referenced asset missing: "+filename);
  if(existsSync(full))localSet.add(localFile);
 }
}
for(const url of [...html.matchAll(/href="(#[^"]+)"/g)].map(m=>m[1].slice(1)))
 assert(html.includes('id="'+url+'"'),"Broken in-page navigation anchor #"+url);
assert(/name="robots" content="noindex,nofollow"/.test(html),"Missing noindex");
assert(/Content-Security-Policy/.test(headers),"Missing published-host CSP template");
assert(/default-src 'self'/.test(headers)&&/script-src 'self'/.test(headers)&&/object-src 'none'/.test(headers),"CSP too relaxed");
assert(/frame-ancestors 'none'/.test(headers),"Missing frame-ancestors gate");
assert(/Content-Security-Policy/.test(html),"Missing local CSP meta fallback");
assert(!/<form\b|<iframe\b|<video\b/i.test(html),"Unauthorized form/iframe/video");
assert(!/(?:onload|onclick|onerror)\s*=/.test(html),"Inline event attribute detected");
for(const [i,s] of js.entries()){
 assert(!/\b(?:eval|new Function)\s*\(/.test(s),"Unsafe eval in scripts index "+i);
 assert(!/\b(?:fetch|WebSocket|XMLHttpRequest|sendBeacon)\s*\(/.test(s),"Unauthorized network call in scripts index "+i);
}
assert(styles.every(s=>!/@import\b|url\(\s*['"]?https?:/i.test(s)),"Remote CSS dependency");
assert(!/\b(?:pages:\s*write|id-token:\s*write)\b/.test(read(".github/workflows/preview-checks.yml")),"CI write token permission");
const budget={html_bytes:35000,typography_css_bytes:2800,v5_css_bytes:16000,system_css_bytes:9000,hero_css_bytes:9500,visual02_css_bytes:8200,hero_webp_bytes:210000,mobile_hero_webp_bytes:85000};
const sizes={html_bytes:statSync(resolve(root,"index.html")).size,
 typography_css_bytes:statSync(resolve(root,"styles-typography.css")).size,
 v5_css_bytes:statSync(resolve(root,"styles-v5.css")).size,
 system_css_bytes:statSync(resolve(root,"styles-system.css")).size,
 hero_css_bytes:statSync(resolve(root,"styles-hero-photo.css")).size,
 visual02_css_bytes:statSync(resolve(root,"styles-visual02.css")).size,
 hero_webp_bytes:statSync(resolve(root,"assets/desset-hero-entrega-dos-espejos.webp")).size,
 mobile_hero_webp_bytes:statSync(resolve(root,"assets/desset-hero-entrega-mobile.webp")).size};
for(const [name,size]of Object.entries(sizes))assert(size<=budget[name],name+" exceeds budget");
const report={schema:"desset-v5.3-static-gate-v1",checks:"resource allowlist; CSP; no external JS/CSS; noindex; anchors; no deploy; byte budgets",
 assets_checked:[...localSet].sort(),sizes,warnings,issues,
 limitations:"Source scanner only; not a replacement for SAST, SCA, penetration testing or HTTP production validation."};
mkdirSync(resolve(root,"reports/quality"),{recursive:true});
writeFileSync(resolve(root,"reports/quality/static.json"),JSON.stringify(report,null,2)+"\n");
console.log("DESSET static/source gate "+(issues.length?"FAIL":"PASS")+": "+localSet.size+" assets, "+issues.length+" issues.");
if(issues.length){console.error(issues.join("\n"));process.exitCode=1}
