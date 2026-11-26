/** Preview HTTP estricto SOLO para auditoría local CI. NO DESPLIEGUE. */
import {createServer} from "node:http";
import {createReadStream} from "node:fs";
import {stat} from "node:fs/promises";
import {resolve,sep} from "node:path";
import {fileURLToPath} from "node:url";

const projectRoot=resolve(fileURLToPath(new URL("../",import.meta.url)));
const root=process.env.DESSET_PRIME_WEB_ROOT==="dist"
 ? resolve(projectRoot,"dist")
 : projectRoot;
const host="127.0.0.1";
const port=4173;
const mime={".html":"text/html; charset=utf-8",".css":"text/css; charset=utf-8",
 ".js":"text/javascript; charset=utf-8",".svg":"image/svg+xml",
 ".png":"image/png",".webp":"image/webp",".mp4":"video/mp4",".woff2":"font/woff2",".txt":"text/plain; charset=utf-8",".glb":"model/gltf-binary"};
const permitted=rel=>rel==="index.html"||rel==="empresa.html"||rel==="comercios.html"||rel==="repartidores.html"||rel==="prime.html"||rel==="contacto.html"||rel==="confianza.html"||rel==="noticias.html"||rel==="talento.html"||rel==="en.html"||rel==="registro-comercios.html"||rel==="incorporacion-comercios.html"||rel==="registro-repartidores.html"||rel==="incorporacion-repartidores.html"||rel==="capacitacion-repartidores.html"||rel==="aplicaciones.html"||rel==="aplicaciones-clientes.html"||rel==="aplicaciones-comercios.html"||rel==="aplicaciones-repartidores.html"||rel==="styles-applications.css"||rel==="styles-onboarding.css"||rel==="styles.css"||rel==="styles-v5.css"||rel==="styles-system.css"||rel==="styles-hero-photo.css"||rel==="styles-visual02.css"||rel==="styles-service-video.css"||rel==="styles-typography.css"||rel==="styles-audiences.css"||rel==="styles-prime.css"||rel==="styles-contact.css"||rel==="styles-trust.css"||rel==="styles-news.css"||rel==="styles-careers.css"
 || /^fonts\/(?:inter-latin-variable|plus-jakarta-sans-latin-variable)\.woff2$/.test(rel)
 || /^fonts\/LICENSE-(?:Inter|Plus-Jakarta-Sans)-OFL\.txt$/.test(rel)
 || /^scripts\/(?:app|motion|v5-cinematic|service-state)\.js$/.test(rel)
 || /^assets\/[a-z0-9-]+\.(?:png|svg|webp)$/.test(rel)
 || /^assets\/servicio-(?:desset|prime)\.mp4$/.test(rel)
 || rel==="assets/v6-three.bundle.js"
 || /^assets\/v62-(?:commerce|courier|destination)\.glb$/.test(rel);
const server=createServer(async(req,res)=>{
 const headers={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff",
  "X-Robots-Tag":"noindex, nofollow","Referrer-Policy":"no-referrer",
  "Content-Security-Policy":"default-src 'self'; base-uri 'none'; object-src 'none'; img-src 'self'; style-src 'self'; font-src 'self'; script-src 'self'; form-action 'none'; frame-ancestors 'none'"};
 const reject=(code)=>{res.writeHead(code,headers);res.end();};
 if(req.method!=="GET"&&req.method!=="HEAD")return reject(405);
 let rel;
 try{
  const url=new URL(req.url,"http://"+host+":"+port);
  if(url.hostname!==host)return reject(400);
  rel=decodeURIComponent(url.pathname).replace(/^\/+/, "")||"index.html";
 }catch{return reject(400)}
 if(/^assets\/roles-geometry-(?:v2|es|mobile-es)\.svg$/.test(rel))return reject(404);
 if(!permitted(rel)||rel.includes("..")||rel.includes("\\"))return reject(404);
 const abs=resolve(root,rel);
 if(!abs.startsWith(root+sep))return reject(404);
 try{
  const info=await stat(abs);
  if(!info.isFile())return reject(404);
  const ext="."+rel.split(".").at(-1);
  if(ext===".mp4"&&req.headers.range){const match=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);const start=match?Number(match[1]):-1,end=match&&match[2]?Math.min(Number(match[2]),info.size-1):info.size-1;if(!match||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||start>end||start>=info.size){res.writeHead(416,{...headers,"Content-Range":"bytes */"+info.size});return res.end();}res.writeHead(206,{...headers,"Content-Type":"video/mp4","Accept-Ranges":"bytes","Content-Range":`bytes ${start}-${end}/${info.size}`,"Content-Length":end-start+1});if(req.method==="HEAD")return res.end();return createReadStream(abs,{start,end}).on("error",()=>res.destroy()).pipe(res);}
  res.writeHead(200,{...headers,"Content-Type":mime[ext]||"application/octet-stream",...(ext===".mp4"?{"Accept-Ranges":"bytes"}:{}),
   "Content-Length":info.size});
  if(req.method==="HEAD")return res.end();
  createReadStream(abs).on("error",()=>res.destroy()).pipe(res);
 }catch{return reject(404)}
});
server.listen(port,host,()=>console.log("DESSET V5 CI-only preview http://"+host+":"+port));
