/** Summarize local, synthetic Lighthouse findings. INP is NOT measured in laboratory. */
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {resolve} from "node:path";
const dir=resolve("reports/lighthouse");
await mkdir(dir,{recursive:true});
const out={schema:"desset-v5.3-lighthouse-lab-v1",environment:"GitHub Actions Ubuntu runner / local loopback / simulated throttling",
 note:"Synthetic lab results, not CrUX, field CWV, real mobile data or publication approval.",
 audits:{},failures:[],warnings:[]};
for(const kind of ["mobile","desktop"]){
 let raw;
 try{raw=JSON.parse(await readFile(resolve(dir,kind+".json"),"utf8"))}
 catch(e){out.failures.push(kind+" report missing or unreadable: "+e.message);continue}
 if(raw.runtimeError){out.failures.push(kind+" Lighthouse runtime error "+JSON.stringify(raw.runtimeError));continue}
 const categories={};
 for(const key of ["performance","accessibility","best-practices"]){
  const c=raw.categories?.[key];
  categories[key]=typeof c?.score==="number"?Math.round(c.score*100):null;
  if(categories[key]===null)out.failures.push(kind+" missing category "+key);
 }
 const get=id=>{const a=raw.audits?.[id];return typeof a?.numericValue==="number"?Math.round(a.numericValue*100)/100:null};
 const metrics={
  lcp_ms:get("largest-contentful-paint"),fcp_ms:get("first-contentful-paint"),
  cls:get("cumulative-layout-shift"),tbt_ms:get("total-blocking-time"),
  speed_index_ms:get("speed-index"),tti_ms:get("interactive")
 };
 if(metrics.lcp_ms===null||metrics.cls===null)out.failures.push(kind+" LCP/CLS unavailable");
 if(metrics.lcp_ms>2500)out.warnings.push(kind+" laboratory LCP > 2.5 s");
 if(metrics.cls>0.1)out.warnings.push(kind+" laboratory CLS > 0.1");
 if(categories.performance!==null&&categories.performance<85)out.warnings.push(kind+" laboratory performance <85");
 if(categories.accessibility!==null&&categories.accessibility<90)out.warnings.push(kind+" accessibility score <90");
 // Hard CI sentinel budgets for synthetic lab regressions only. These are not field CWV gates.
 if(categories.performance!==null&&categories.performance<85)out.failures.push(kind+" performance score <85");
 if(categories.accessibility!==null&&categories.accessibility<90)out.failures.push(kind+" accessibility score <90");
 if(categories["best-practices"]!==null&&categories["best-practices"]<90)out.failures.push(kind+" best-practices score <90");
 if(metrics.cls!==null&&metrics.cls>0.1)out.failures.push(kind+" lab CLS >0.1");
 if(metrics.lcp_ms!==null&&metrics.lcp_ms>4000)out.failures.push(kind+" lab LCP >4000ms");
 out.audits[kind]={
  categories,metrics,
  lighthouseVersion:raw.lighthouseVersion,
  finalUrl:raw.finalDisplayedUrl||raw.finalUrl||null,
  runtimeEnvironment:{userAgent:raw.userAgent,benchmarkIndex:raw.environment?.benchmarkIndex??null}
 };
}
const summary=JSON.stringify(out,null,2)+"\n";
await writeFile(resolve(dir,"summary.json"),summary);
const md=["# DESSET V5.3 — Lighthouse sintético (CI loopback)","","**NO hay datos de usuarios reales, INP medido ni autorización de publicación.**","",
 "| Entorno | Performance | Accesibilidad | Buenas prácticas | LCP lab ms | CLS lab | TBT ms |",
 "|---|---:|---:|---:|---:|---:|---:|"];
for(const [kind,a]of Object.entries(out.audits))
 md.push("| "+kind+" | "+a.categories.performance+" | "+a.categories.accessibility+" | "+a.categories["best-practices"]+" | "+a.metrics.lcp_ms+" | "+a.metrics.cls+" | "+a.metrics.tbt_ms+" |");
md.push("","## Advertencias",...(out.warnings.length?out.warnings.map(x=>"- "+x):["- Ninguna bajo umbrales orientativos."]),
 "","## Limitaciones","- LCP/CLS son observaciones de laboratorio. INP exige interacciones/usuarios reales, no TBT.",
 "- No mide dispositivos físicos, redes móviles comerciales ni despliegue Cloudflare.",
 "- Lighthouse verifica accesibilidad automatizada, no la revisión manual ni Figma.",
 "- Cumplir un score no implica GO legal, IP, DNS o producción.","");
await writeFile(resolve(dir,"summary.md"),md.join("\n")+"\n");
console.log(JSON.stringify({audits:out.audits,warnings:out.warnings,failures:out.failures},null,2));
if(out.failures.length)process.exitCode=1;
