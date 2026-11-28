// Test-only in-process loopback fixture. No external listener or persistent database.
import {createServer} from "node:http";
import {readFileSync} from "node:fs";
import {resolve,extname} from "node:path";
import {randomBytes} from "node:crypto";
import {DatabaseSync} from "node:sqlite";
import {createD1BrowserBackend} from "./contact-e2e-d1-backend.mjs";
import {makeContactHandler,ORIGIN,categories,purgeSynthetic} from "../internal/contact-service/service.mjs";
import {makePanel} from "../internal/contact-service/panel.mjs";
const root=resolve(".");
const read=p=>readFileSync(resolve(root,p));
const html=read("internal/contact-ready/index.html").toString();
const bridge=read("scripts/contact-e2e-bridge.js");
const requireReplace=(s,a,b)=>{if(s.split(a).length!==2)throw Error("fixture template mismatch: "+a);return s.replace(a,b);};
let template=requireReplace(html,"connect-src 'none'","connect-src 'self'");
template=requireReplace(template,"No se envía ni almacena información.","Se registra únicamente información sintética en memoria durante esta prueba.");
template=requireReplace(template,"No se enviará ni almacenará información.","Los datos ficticios se procesan en una base temporal de prueba.");
template=requireReplace(template,"Sin recepción de mensajes en esta vista interna.","Recepción sintética local, sin servicio público.");
template=requireReplace(template,"</head>",'<script defer src="/__fixture/bridge.js"></script></head>');
const staticPaths=new Set(["/styles.css","/styles-system.css","/styles-typography.css","/styles-contact.css","/scripts/app.js","/assets/deliver-assets-mark.png","/fonts/inter-latin-variable.woff2","/fonts/plus-jakarta-sans-latin-variable.woff2","/internal/contact-ready/contact-ready.css","/internal/contact-ready/contact-ready.js"]);
const types={".css":"text/css; charset=utf-8",".js":"text/javascript; charset=utf-8",".png":"image/png",".woff2":"font/woff2"};
const common={"Cache-Control":"no-store","X-Content-Type-Options":"nosniff","X-Robots-Tag":"noindex, nofollow","Referrer-Policy":"no-referrer"};
export async function startFixture({d1=false}={}){
 if(process.env.CI!=="true"||process.env.DESSET_CONTACT_SYNTHETIC_E2E!=="1")throw Error("CI fixture explicitly disabled");
 const db=d1?null:new DatabaseSync(":memory:");if(db)db.exec(read("internal/contact-service/schema.sql").toString());
 const admin=randomBytes(32).toString("hex"),restricted=randomBytes(32).toString("hex"),csrf=randomBytes(32).toString("hex");
 let at=1700000000000,enabled=true,allowChallenge=true;
 let attempts=0;const transitions=[];
 const options={db,mode:"synthetic-local",enabled:true,rateLimit:async()=>++attempts<=100,verifyChallenge:async(token,c)=>allowChallenge&&token==="synthetic-test"&&c.hostname==="contact-preview.invalid"&&c.action==="contact_intake",authorizeAdmin:async req=>{const t=req.headers.get("X-Fixture-Admin");if(t===admin)return {id:"synthetic-admin-all",categories:[...categories],csrf};if(t===restricted)return {id:"synthetic-admin-restricted",categories:["marketing"],csrf};return null;},now:()=>at};
 const backend=d1?await createD1BrowserBackend({admin,restricted}):null;
 const api=d1?null:makeContactHandler(options),panel=d1?null:makePanel(options,read("internal/contact-service/panel.css").toString());
 const d1Template=template.replace('<script defer src="/__fixture/bridge.js"></script>','<script type="module" src="/__fixture/d1-bridge.mjs"></script>');
 let origin;
 const server=createServer(async(req,res)=>{
  const send=async response=>{res.writeHead(response.status,{...common,...Object.fromEntries(response.headers)});res.end(Buffer.from(await response.arrayBuffer()));};
  try{
   if(req.socket.remoteAddress!=="127.0.0.1"||req.headers.host!==new URL(origin).host||!req.url?.startsWith("/")||req.url.startsWith("//"))return await send(new Response("Denied",{status:403}));
   const url=new URL(req.url,origin);
   if(url.origin!==origin)return await send(new Response("Denied",{status:403}));
   if(req.method==="GET"&&url.pathname==="/internal/contact-ready/index.html")return await send(new Response(d1?d1Template:template,{headers:{"Content-Type":"text/html; charset=utf-8"}}));
   if(d1&&req.method==="GET"&&["/__fixture/d1-bridge.mjs","/internal/contact-platform/intake-client.mjs","/internal/contact-platform/d1-store.mjs"].includes(url.pathname))return await send(new Response(read(url.pathname==="/__fixture/d1-bridge.mjs"?"scripts/contact-e2e-d1-bridge.mjs":url.pathname.slice(1)),{headers:{"Content-Type":"text/javascript; charset=utf-8"}}));
   if(!d1&&req.method==="GET"&&url.pathname==="/__fixture/bridge.js")return await send(new Response(bridge,{headers:{"Content-Type":"text/javascript; charset=utf-8"}}));
   if(req.method==="GET"&&staticPaths.has(url.pathname))return await send(new Response(read(url.pathname.slice(1)),{headers:{"Content-Type":types[extname(url.pathname)]}}));
   if(!["GET","POST"].includes(req.method)||!(url.pathname==="/api/contact"||url.pathname==="/panel"||url.pathname.startsWith("/panel/")))return await send(new Response("Not found",{status:404}));
   if(!enabled)return await send(new Response("Disabled",{status:503}));
   const h=new Headers();for(const name of ["content-type","sec-fetch-site","x-fixture-admin"])if(typeof req.headers[name]==="string")h.set(name,req.headers[name]);
   if(req.headers.origin===origin)h.set("Origin",d1?"https://contacto.desset.lat":ORIGIN);else if(req.headers.origin)h.set("Origin","https://rejected.invalid");
   let buf=Buffer.alloc(0);
   if(req.method==="POST"){for await(const chunk of req){if(buf.length+chunk.length>12000)return await send(new Response("Too large",{status:413}));buf=Buffer.concat([buf,chunk]);}}
   const request=new Request((d1?"https://contacto.desset.lat":ORIGIN)+url.pathname+url.search,{method:req.method,headers:h,...(req.method==="POST"?{body:buf}:{})});
   const response=await (d1?backend.handle(request):url.pathname==="/api/contact"?api(request):panel(request));
   if(url.pathname==="/panel/transition")transitions.push({status:response.status,origin:req.headers.origin===origin?"same-origin":req.headers.origin==="null"?"null":req.headers.origin?"other":"missing",fetchSite:req.headers["sec-fetch-site"]==="same-origin"?"same-origin":"other",authorized:h.get("X-Fixture-Admin")===admin||h.get("X-Fixture-Admin")===restricted});
   return await send(response);
  }catch{return await send(new Response("Unavailable",{status:503}));}
 });
 await new Promise((ok,no)=>{server.once("error",no);server.listen(0,"127.0.0.1",ok);});
 origin="http://127.0.0.1:"+server.address().port;
 return {origin,admin,restricted,db:d1?backend.db:db,transitions,disable:()=>{enabled=false;},challenge:v=>{allowChallenge=v;if(d1)backend.challenge(v);},purge:()=>{at+=7*86400000;return d1?backend.purge():purgeSynthetic(db,at);},close:async()=>{await new Promise(ok=>{server.close(ok);server.closeAllConnections();});if(d1)await backend.close();else db.close();}};
}
