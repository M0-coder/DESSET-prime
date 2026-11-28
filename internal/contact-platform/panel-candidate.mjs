// Disconnected D1 panel candidate. No listener, global fetch, deployment entrypoint or public asset.
import {authorizeContact,proposedOrigin} from "./gates.mjs";
import {categories,uuid,queue,detail,transition} from "./d1-store.mjs";
const labels={alianzas:"Alianzas",inversion:"Inversionistas",marketing:"Marketing",prensa:"Prensa",instituciones:"Instituciones",profesionales:"Talento",legal:"Legal",seguridad:"Seguridad y privacidad",otras:"Otras consultas"};
const states={RECEIVED:"Recibida",IN_REVIEW:"En revisión",CLOSED:"Cerrada"};
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const headers={"Content-Type":"text/html; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff","X-Robots-Tag":"noindex, nofollow","Referrer-Policy":"same-origin","Content-Security-Policy":"default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"};
const page=(html,status=200)=>new Response('<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>DESSET — Contacto institucional</title></head><body><main>'+html+'</main></body></html>',{status,headers});
const error=status=>page("<h1>Acceso o solicitud no disponible</h1>",status);
const hex=v=>typeof v==="string"&&/^[a-f0-9]{64}$/.test(v);
const validActor=a=>a&&typeof a.actor==="string"&&/^[A-Za-z0-9_.:-]{1,128}$/.test(a.actor)&&Array.isArray(a.categories)&&a.categories.length>0&&a.categories.every(c=>categories.includes(c))&&new Set(a.categories).size===a.categories.length&&hex(a.csrf);
async function form(req){
 if((req.headers.get("content-type")??"").split(";")[0].trim()!=="application/x-www-form-urlencoded"||!req.body)return null;
 const reader=req.body.getReader(),decoder=new TextDecoder("utf-8",{fatal:true});let n=0,s="";
 try{while(true){const x=await reader.read();if(x.done)break;n+=x.value.byteLength;if(n>2048){await reader.cancel();return null;}s+=decoder.decode(x.value,{stream:true});}s+=decoder.decode();
 const p=new URLSearchParams(s),keys=[...p.keys()];if(keys.length!==4||new Set(keys).size!==4||!["id","state","version","csrf"].every(k=>p.has(k)))return null;
 return Object.fromEntries(p);}catch{return null;}finally{reader.releaseLock();}
}
export function createPanelCandidate({authorize=authorizeContact,now=Date.now}={}){
 return async(req,env,ctx)=>{
  try{
   if(env?.CONTACT_PANEL_ENABLED!=="true"||env.CONTACT_ADMIN_ENABLED!=="true"||env.ENVIRONMENT!=="production"||!env.CONTACT_DB)return error(503);
   const url=new URL(req.url);if(url.origin!==proposedOrigin||env.CONTACT_ORIGIN!==proposedOrigin)return error(403);
   if(req.method==="POST"&&(req.headers.get("Origin")!==proposedOrigin||req.headers.get("Sec-Fetch-Site")==="cross-site"))return error(403);
   const a=await authorize(req,env,ctx);if(!validActor(a))return error(403);
   const actor=Object.freeze({actor:a.actor,categories:Object.freeze([...a.categories]),csrf:a.csrf}),at=now();
   if(!Number.isSafeInteger(at)||at<0)return error(503);
   if(req.method==="GET"&&url.pathname==="/panel"){
    const cat=url.searchParams.get("category")??actor.categories[0];if(!actor.categories.includes(cat))return error(403);
    const rows=await queue(env.CONTACT_DB,actor,cat,at);
    if(!Array.isArray(rows)||rows.length>100||rows.some(x=>typeof x.id!=="string"||!uuid.test(x.id)||x.category!==cat||!Object.hasOwn(states,x.state)))return error(503);
    const nav='<nav aria-label="Departamentos">'+actor.categories.map(c=>'<a href="/panel?category='+esc(c)+'">'+esc(labels[c])+'</a> ').join("")+'</nav>';
    return page('<h1>Consultas institucionales</h1>'+nav+'<h2>'+esc(labels[cat])+'</h2><p>'+rows.length+' registros (máximo 100 por vista; paginación pendiente).</p><ul>'+rows.map(x=>'<li><a href="/panel/request/'+esc(x.id)+'">Consulta '+esc(x.id)+'</a> · '+esc(states[x.state])+'</li>').join("")+'</ul>');
   }
   if(req.method==="GET"&&url.pathname.startsWith("/panel/request/")){
    const id=url.pathname.slice("/panel/request/".length);if(!uuid.test(id))return error(404);
    const x=await detail(env.CONTACT_DB,actor,id,at);
    if(x.id!==id||!actor.categories.includes(x.category))return error(404);
    if(!Object.hasOwn(states,x.state)||!Number.isSafeInteger(x.version)||x.version<0)return error(503);
    const fields=[["Departamento",labels[x.category]],["Estado",states[x.state]],["Persona",x.person],["Correo",x.email],["Organización",x.organization],["Teléfono",x.phone],["Asunto",x.subject],["Mensaje",x.message]];
    const next=x.state==="RECEIVED"?"IN_REVIEW":x.state==="IN_REVIEW"?"CLOSED":null;
    const hidden=(k,v)=>'<input type="hidden" name="'+k+'" value="'+esc(v)+'">';
    return page('<a href="/panel?category='+esc(x.category)+'">Volver a la bandeja</a><h1>Detalle de consulta</h1><p>'+esc(id)+'</p><dl>'+fields.map(([k,v])=>'<dt>'+esc(k)+'</dt><dd>'+esc(v||"—")+'</dd>').join("")+'</dl>'+(next?'<form method="post" action="/panel/transition">'+hidden("id",id)+hidden("version",x.version)+hidden("state",next)+hidden("csrf",actor.csrf)+'<button type="submit">'+(next==="IN_REVIEW"?"Iniciar revisión":"Cerrar consulta")+'</button></form>':'<p>Consulta cerrada.</p>'));
   }
   if(req.method==="POST"&&url.pathname==="/panel/transition"){
    const v=await form(req);if(!v||v.csrf!==actor.csrf)return error(403);
    if(!uuid.test(v.id)||!/^(0|[1-9][0-9]{0,15})$/.test(v.version)||!Number.isSafeInteger(Number(v.version))||!["IN_REVIEW","CLOSED"].includes(v.state))return error(400);
    const changed=await transition(env.CONTACT_DB,actor,{id:v.id,state:v.state,version:Number(v.version)},at);
    if(changed.id!==v.id||changed.state!==v.state||changed.version!==Number(v.version)+1)return error(503);
    return new Response(null,{status:303,headers:{...headers,Location:"/panel/request/"+v.id}});
   }
   return error(404);
  }catch(e){return error([400,403,404,409,429,503].includes(e?.status)?e.status:503);}
 };
}
