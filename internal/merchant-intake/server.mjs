// Loopback-only synthetic integration server. No public endpoint or production mode.
import {createServer} from "node:http";
import {randomBytes,createHash,scrypt,timingSafeEqual} from "node:crypto";
import {promisify} from "node:util";
import {openMerchantIntake} from "./intake.mjs";
const derive=promisify(scrypt);
const digest=v=>createHash("sha256").update(v).digest("hex");
const token=()=>randomBytes(32).toString("hex");
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fail=(status,code)=>Object.assign(Error(code),{status,code});
const headers={"Cache-Control":"no-store","Content-Security-Policy":"default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","X-Robots-Tag":"noindex, nofollow"};
const send=(res,status,body,type="application/json; charset=utf-8",extra={})=>{res.writeHead(status,{...headers,"Content-Type":type,...extra});res.end(type.startsWith("application/json")?JSON.stringify(body):body);};
const page=(res,body,status=200)=>send(res,status,'<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>DESSET | Incorporación interna de ensayo</title><main><h1>DESSET — Ensayo privado</h1>'+body+'</main></html>',"text/html; charset=utf-8");
async function readBody(req,kind){
 if((req.headers["content-type"]??"").split(";")[0].trim()!==kind)throw fail(415,"CONTENT_TYPE");
 let bytes=0,parts=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>8192)throw fail(413,"BODY_LIMIT");parts.push(chunk);}
 try{const raw=Buffer.concat(parts).toString("utf8");if(kind==="application/json"){const v=JSON.parse(raw);if(!v||typeof v!=="object"||Array.isArray(v))throw Error();return v;}const params=new URLSearchParams(raw);if(new Set(params.keys()).size!==[...params.keys()].length)throw Error();return Object.fromEntries(params);}catch{throw fail(400,"INVALID_BODY");}
}
const exact=(obj,keys)=>Object.keys(obj).every(k=>keys.includes(k));
const businessErrors={INTAKE_DISABLED:503,PRIVACY_REQUIRED:400,INVALID_REQUEST_KEY:400,INVALID_FIELDS:400,INVALID_FIELD:400,INVALID_CONTACT_OR_CATEGORY:400,IDEMPOTENCY_CONFLICT:409,DUPLICATE_BUSINESS:409,NOT_PENDING:409,INVALID_DECISION:400,INVALID_OFFSET:400};
export async function makeReviewerCredential(password){
 if(typeof password!=="string"||password.length<16||password.length>256)throw Error("INVALID_TEST_PASSWORD");
 const salt=randomBytes(32);return {salt:salt.toString("hex"),hash:(await derive(password,salt,64)).toString("hex")};
}
export async function startSyntheticIntake({databasePath,credential,syntheticEnabled=false,privacyVersion="TEST-v1",sessionMs=900000,port=0}={}){
 if(!databasePath||typeof databasePath!=="string"||!credential||!/^[a-f0-9]{64}$/.test(credential.salt)||!/^[a-f0-9]{128}$/.test(credential.hash)||!/^TEST-[A-Za-z0-9-]+$/.test(privacyVersion)||!Number.isSafeInteger(sessionMs)||sessionMs<1||sessionMs>3600000)throw Error("INVALID_TEST_CONFIGURATION");
 const store=openMerchantIntake(databasePath,{enabled:syntheticEnabled===true,privacyVersion});
 const actor=Object.freeze({id:"synthetic-owner",role:"merchant-reviewer"}),sessions=new Map(),limits=new Map();
 let origin;
 const rate=(bucket,max,interval)=>{const at=Date.now();let v=limits.get(bucket);if(!v||v.until<=at)v={count:0,until:at+interval};v.count++;limits.set(bucket,v);if(v.count>max)throw fail(429,"RATE_LIMIT");};
 function session(req){const raw=(req.headers.cookie??"").split(";").map(v=>v.trim()).filter(v=>v.startsWith("desset_test_session="));if(raw.length!==1)return null;const key=raw[0].slice("desset_test_session=".length);if(!/^[a-f0-9]{64}$/.test(key))return null;const hash=digest(key),s=sessions.get(hash);if(!s)return null;if(s.expires<=Date.now()){sessions.delete(hash);return null;}return {...s,hash};}
 function requireSession(req){const s=session(req);if(!s)throw fail(401,"AUTH_REQUIRED");return s;}
 function csrf(s,value){if(typeof value!=="string"||value!==s.csrf)throw fail(403,"CSRF");}
 function panel(res,s,offset){
  const rows=store.list(actor,offset);
  const details=rows.map(r=>'<article><h2>'+esc(r.business_name)+'</h2><p>Referencia: '+esc(r.id)+' | Estado: '+esc(r.status)+'</p><p>'+esc(r.category)+' — '+esc(r.department)+' / '+esc(r.province)+' / '+esc(r.district)+' — '+esc(r.address)+'</p><p>'+esc(r.contact_name)+' | '+esc(r.phone)+' | '+esc(r.email)+'</p><p>'+esc(r.observations)+'</p><p>Notificación: '+esc(store.notificationState(actor,r.id)?.status)+' | Intentos: '+esc(store.notificationState(actor,r.id)?.attempts)+'</p><ul>'+store.history(actor,r.id).map(h=>'<li>'+esc(h.decision)+' · '+esc(h.actor_id)+' · '+esc(h.created_at)+'</li>').join('')+'</ul>'+(r.status==="PENDING"?'<form method="post" action="/admin/review"><input type="hidden" name="csrf" value="'+s.csrf+'"><input type="hidden" name="id" value="'+esc(r.id)+'"><button name="decision" value="APPROVED">Aprobar solicitud</button> <button name="decision" value="REJECTED">Rechazar solicitud</button></form>':'')+'</article>').join('');
  page(res,'<p>Solo datos sintéticos. Aprobar no activa comercios.</p><form method="post" action="/logout"><input type="hidden" name="csrf" value="'+s.csrf+'"><button>Cerrar sesión</button></form>'+details+(offset?'<a href="/admin?offset='+Math.max(0,offset-100)+'">Anterior</a> ':'')+(rows.length===100?'<a href="/admin?offset='+(offset+100)+'">Siguiente</a>':''));
 }
 const server=createServer(async(req,res)=>{
  try{
   if(req.socket.remoteAddress!=="127.0.0.1"||req.headers.host!==new URL(origin).host)throw fail(403,"HOST");
   const url=new URL(req.url,origin),path=url.pathname;
   if(url.origin!==origin)throw fail(403,"HOST");
   if(req.method==="POST"&&req.headers.origin!==origin)throw fail(403,"ORIGIN");
   if(req.method==="GET"&&path==="/login")return page(res,'<form method="post" action="/login"><label>Contraseña de ensayo <input type="password" name="password" required maxlength="256" autocomplete="current-password"></label><button>Ingresar</button></form>');
   if(req.method==="POST"&&path==="/login"){
    rate("login",8,60000);
    const b=await readBody(req,"application/x-www-form-urlencoded");
    if(!exact(b,["password"])||typeof b.password!=="string"||b.password.length>256)throw fail(401,"AUTH_FAILED");
    const hash=await derive(b.password,Buffer.from(credential.salt,"hex"),64);
    if(!timingSafeEqual(hash,Buffer.from(credential.hash,"hex")))throw fail(401,"AUTH_FAILED");
    for(const [k,s] of sessions)if(s.expires<=Date.now())sessions.delete(k);
    const previous=session(req);if(previous)sessions.delete(previous.hash);
    if(sessions.size>=32)throw fail(429,"SESSION_LIMIT");
    const key=token();sessions.set(digest(key),{csrf:token(),expires:Date.now()+sessionMs});
    return send(res,303,"","text/plain",{Location:"/admin","Set-Cookie":"desset_test_session="+key+"; HttpOnly; SameSite=Strict; Path=/"});
   }
   if(req.method==="POST"&&path==="/api/intake"){
    if(syntheticEnabled!==true)throw fail(503,"INTAKE_DISABLED");
    rate("intake",60,60000);const b=await readBody(req,"application/json");
    if(!exact(b,["input","requestKey","privacyVersion","consent"])||typeof b.input?.email!=="string"||!/^[^@\s]+@[^@\s]+\.invalid$/i.test(b.input.email)||b.input.phone!=="+51900000000"||typeof b.input.business_name!=="string"||!b.input.business_name.startsWith("Synthetic "))throw fail(400,"SYNTHETIC_ONLY");
    const result=store.submit(b.input,{requestKey:b.requestKey,privacyVersion:b.privacyVersion,consent:b.consent});
    return send(res,result.replayed?200:201,result);
   }
   if(path==="/admin"&&req.method==="GET"){const s=requireSession(req);const offset=Number(url.searchParams.get("offset")??0);return panel(res,s,offset);}
   if(path==="/api/admin/requests"&&req.method==="GET"){const s=requireSession(req);const offset=Number(url.searchParams.get("offset")??0);return send(res,200,{csrf:s.csrf,requests:store.list(actor,offset).map(r=>({...r,history:store.history(actor,r.id),notification:store.notificationState(actor,r.id)}))});}
   if(req.method==="POST"&&(path==="/admin/review"||path==="/api/admin/review"||path==="/logout")){
    const s=requireSession(req),json=path.startsWith("/api/"),b=await readBody(req,json?"application/json":"application/x-www-form-urlencoded");
    csrf(s,json?req.headers["x-csrf-token"]:b.csrf);
    if(path==="/logout"){if(!exact(b,["csrf"]))throw fail(400,"INVALID_BODY");sessions.delete(s.hash);return send(res,303,"","text/plain",{Location:"/login","Set-Cookie":"desset_test_session=; Max-Age=0; HttpOnly; SameSite=Strict; Path=/"});}
    if(!exact(b,json?["id","decision"]:["id","decision","csrf"])||typeof b.id!=="string"||!/^[a-f0-9-]{36}$/.test(b.id))throw fail(400,"INVALID_BODY");
    const result=store.review(actor,b.id,b.decision);return json?send(res,200,result):send(res,303,"","text/plain",{Location:"/admin"});
   }
   return send(res,404,{error:"NOT_FOUND"});
  }catch(e){if(!res.headersSent&&!res.destroyed){const status=e.status??businessErrors[e.message]??500;send(res,status,{error:(e.status?e.code:businessErrors[e.message]?e.message:"INTERNAL_ERROR")});}else res.destroy();}
 });
 server.requestTimeout=10000;server.headersTimeout=5000;server.maxHeadersCount=40;server.maxConnections=32;
 try{await new Promise((resolve,reject)=>{server.once("error",reject);server.listen(port,"127.0.0.1",resolve);});origin="http://127.0.0.1:"+server.address().port;}catch(e){store.close();throw e;}
 return {origin,close:async()=>{await new Promise((resolve,reject)=>{server.close(e=>e?reject(e):resolve());server.closeAllConnections();});sessions.clear();store.close();}};
}
