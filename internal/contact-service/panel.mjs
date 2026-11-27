// Internal synthetic HTML adapter. No HTTP listener, deployment, or real identity provider.
import {makeContactHandler,categories,ORIGIN} from "./service.mjs";
const labels={alianzas:"Alianzas",inversion:"Inversionistas",marketing:"Marketing",prensa:"Prensa",instituciones:"Instituciones",profesionales:"Talento",legal:"Legal",seguridad:"Seguridad y privacidad",otras:"Otras consultas"};
const states={RECEIVED:"Recibida",IN_REVIEW:"En revisión",CLOSED:"Cerrada"};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const validId=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(id);
const headers={"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","X-Robots-Tag":"noindex, nofollow","Referrer-Policy":"no-referrer","Content-Security-Policy":"default-src 'none'; style-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"};
const page=(body,status=200)=>new Response('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>DESSET — Administración de contacto</title><link rel="stylesheet" href="/panel/style.css"></head><body><header><strong>DESSET</strong><span>Administración institucional</span></header><main><p class="notice">ENTORNO SINTÉTICO · Sin datos reales</p>'+body+'</main></body></html>',{status,headers});
const error=s=>page("<h1>Acceso o solicitud no disponible</h1>",s);
async function body(req){
 if((req.headers.get("content-type")??"").split(";")[0]!=="application/x-www-form-urlencoded"||!req.body)return null;
 const reader=req.body.getReader(),decoder=new TextDecoder("utf-8",{fatal:true});let n=0,s="";
 try{while(true){const r=await reader.read();if(r.done)break;n+=r.value.byteLength;if(n>2048){await reader.cancel();return null;}s+=decoder.decode(r.value,{stream:true});}s+=decoder.decode();const p=new URLSearchParams(s);if([...p.keys()].length!==4||new Set(p.keys()).size!==4||!["id","version","state","csrf"].every(k=>p.has(k)))return null;return Object.fromEntries(p);}finally{reader.releaseLock();}
}
export function makePanel(options,stylesheet){
 const backend=makeContactHandler(options);
 return async req=>{
  try{
   if(options.mode!=="synthetic-local"||options.enabled!==true||typeof options.authorizeAdmin!=="function")return error(503);
   const url=new URL(req.url);if(url.origin!==ORIGIN)return error(403);
   const actor=await options.authorizeAdmin(req);
   if(!actor||!/^synthetic-admin-[a-z0-9-]{1,40}$/.test(actor.id??"")||!Array.isArray(actor.categories)||actor.categories.some(c=>!categories.includes(c))||!/^[a-f0-9]{64}$/.test(actor.csrf??""))return error(403);
   const call=async(path,method="GET",data)=>{const h=new Headers(req.headers);h.delete("content-length");if(method==="POST"){h.set("Content-Type","application/json");h.set("X-CSRF-Token",actor.csrf);}return backend(new Request(ORIGIN+path,{method,headers:h,...(data?{body:JSON.stringify(data)}:{})}));};
   const nav='<nav aria-label="Departamentos">'+categories.filter(c=>actor.categories.includes(c)).map(c=>'<a href="/panel?category='+c+'">'+esc(labels[c])+'</a>').join("")+'</nav>';
   if(req.method==="GET"&&url.pathname==="/panel/style.css")return new Response(stylesheet,{headers:{...headers,"Content-Type":"text/css; charset=utf-8"}});
   if(req.method==="GET"&&url.pathname==="/panel"){
    const cat=url.searchParams.get("category")??actor.categories[0];if(!actor.categories.includes(cat))return error(403);
    const res=await call("/admin/queue?category="+encodeURIComponent(cat));if(!res.ok)return error(res.status);
    const {items}=await res.json();
    return page('<h1>Consultas institucionales</h1>'+nav+'<h2>'+esc(labels[cat])+'</h2><p>'+items.length+' registros en esta vista (máximo 100).</p><div class="queue">'+(items.length?items.map(x=>'<article><a href="/panel/request/'+esc(x.id)+'">Consulta '+esc(x.id)+'</a><span>'+esc(states[x.state])+'</span><small>'+esc(new Date(x.created_at).toISOString())+'</small></article>').join(""):'<p>No hay consultas.</p>')+'</div>');
   }
   if(req.method==="GET"&&url.pathname.startsWith("/panel/request/")){
    const id=url.pathname.slice("/panel/request/".length);if(!validId(id))return error(404);
    const res=await call("/admin/request/"+id);if(!res.ok)return error(res.status);
    const x=await res.json(),next=x.state==="RECEIVED"?"IN_REVIEW":x.state==="IN_REVIEW"?"CLOSED":null;
    const fields=[["Departamento",labels[x.category]],["Estado",states[x.state]],["Persona",x.person],["Correo",x.email],["Organización",x.organization],["Teléfono",x.phone],["Asunto",x.subject],["Mensaje",x.message]];
    const hidden=(k,v)=>'<input type="hidden" name="'+k+'" value="'+esc(v)+'">';
    return page('<a href="/panel?category='+esc(x.category)+'">← Volver a la bandeja</a><h1>Detalle de consulta</h1><p class="identifier">'+esc(x.id)+'</p><dl>'+fields.map(([k,v])=>'<dt>'+esc(k)+'</dt><dd>'+esc(v||"—")+'</dd>').join("")+'</dl>'+(next?'<form method="post" action="/panel/transition">'+hidden("id",id)+hidden("version",x.version)+hidden("state",next)+hidden("csrf",actor.csrf)+'<button type="submit">'+(next==="IN_REVIEW"?"Iniciar revisión":"Cerrar consulta")+'</button></form>':'<p>Consulta cerrada.</p>'));
   }
   if(req.method==="POST"&&url.pathname==="/panel/transition"){
    if(req.headers.get("Origin")!==ORIGIN||req.headers.get("Sec-Fetch-Site")==="cross-site")return error(403);
    const data=await body(req);if(!data||data.csrf!==actor.csrf)return error(403);
    if(!validId(data.id)||!/^(0|[1-9][0-9]{0,8})$/.test(data.version)||!["IN_REVIEW","CLOSED"].includes(data.state))return error(400);
    const res=await call("/admin/transition","POST",{id:data.id,version:Number(data.version),state:data.state});if(!res.ok)return error(res.status);
    return new Response(null,{status:303,headers:{...headers,Location:"/panel/request/"+data.id}});
   }
   return error(404);
  }catch{return error(503);}
 };
}
