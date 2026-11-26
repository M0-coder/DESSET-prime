import {days,commercialMessage} from "./profile.mjs";
const e=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const h=(k,v)=>'<input type="hidden" name="'+e(k)+'" value="'+e(v)+'">';
const input=(label,k,v="",type="text",required=true)=>'<label>'+e(label)+' <input name="'+e(k)+'" type="'+e(type)+'" value="'+e(v)+'"'+(required?' required':'')+'></label>';
const select=(label,k,opts,v="")=>'<label>'+e(label)+' <select name="'+e(k)+'">'+opts.map(([key,label])=>'<option value="'+e(key)+'"'+(key===v?' selected':'')+'>'+e(label)+'</option>').join("")+'</select></label>';
export function preparationPage(data,csrf){
 const {request,contacts,profile:p,version,media,review}=data,id=request.id,base=h("id",id)+h("csrf",csrf),ver=base+h("version",version);
 const link=mid=>"/admin/profile-media?id="+encodeURIComponent(id)+"&media="+encodeURIComponent(mid);
 const photo=mid=>mid?'<img src="'+link(mid)+'" alt="" width="120" loading="lazy">':"";
 const choices=[["","Selecciona una imagen"],...media.map((m,i)=>[m.id,"Imagen "+(i+1)])];
 const form=(action,fields,label)=>'<form method="post" action="/admin/'+action+'">'+fields+'<button>'+label+'</button></form>';
 const channel={PHONE:"Teléfono",EMAIL:"Correo",MEETING:"Reunión",OTHER:"Otro"},outcome={CONTACTED:"Contactado",NO_ANSWER:"Sin respuesta",FOLLOW_UP:"Seguimiento pendiente",DECLINED:"No interesado"};
 const message=commercialMessage(request);
 const email=typeof request.email==="string"&&/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+$/.test(request.email)?'mailto:'+encodeURIComponent(request.email)+'?subject='+encodeURIComponent(message.subject)+'&body='+encodeURIComponent(message.body):null;
 let html='<p><a href="/admin?id='+encodeURIComponent(id)+'">Volver a solicitud</a></p><h2>'+e(request.business_name)+'</h2><h2>Seguimiento comercial</h2><p>Contacto: '+e(request.phone)+' · '+e(request.email)+'</p><label>Comunicación correspondiente al estado actual <textarea readonly rows="7">'+e(message.body)+'</textarea></label>'+(email?'<p><a href="'+e(email)+'">Abrir correo para el comercio</a></p>':"")+'<p>Registra el resultado después de comunicarte. Abrir el correo no acredita su envío.</p>'+form("contact",base+select("Canal","channel",Object.entries(channel))+select("Resultado","outcome",Object.entries(outcome))+'<label>Notas <textarea name="notes" maxlength="1000"></textarea></label>',"Registrar contacto")+contacts.map(c=>'<article><p>'+e(channel[c.channel])+' · '+e(outcome[c.outcome])+' · '+e(new Date(c.created_at).toISOString())+'</p><p>'+e(c.notes)+'</p></article>').join("");
 if(request.status!=="APPROVED")return html;
 const locked=request.stage==="READY_FOR_ACTIVATION";
 html+='<h2>Ficha comercial</h2><p>Versión '+version+' · '+e(review?.decision==="APPROVED"?"Conformidad registrada":review?.decision==="CORRECTIONS_REQUIRED"?"Correcciones solicitadas":"Pendiente de revisión")+'</p>';
 if(!locked){
 html+='<h3>Imágenes del establecimiento y productos</h3><form method="post" action="/admin/profile-upload" enctype="multipart/form-data">'+base+'<label>Imagen PNG o JPEG (máximo 2 MiB) <input required type="file" name="file" accept="image/png,image/jpeg"></label><button>Cargar imagen</button></form>'+media.map((m,i)=>'<p>'+e("Imagen "+(i+1))+' '+photo(m.id)+'</p>').join("");
 html+=form("profile-edit",ver+h("operation","DETAILS")+input("Nombre visible","name",p.name)+input("Descripción","description",p.description,"text",false)+select("Logotipo (opcional)","logo",[["","Sin logotipo"],...choices.slice(1)],p.logo??"")+days.map((d,i)=>'<fieldset><legend>'+d+'</legend>'+input("Apertura","open"+i,p.hours[i]?.open,"time",false)+input("Cierre","close"+i,p.hours[i]?.close,"time",false)+'</fieldset>').join("")+'<p>Deja ambos horarios vacíos si el establecimiento no atiende ese día. Un cierre anterior a la apertura corresponde al día siguiente.</p>',"Guardar ficha");
 const productForm=x=>form("profile-edit",ver+h("operation","PRODUCT")+h("productId",x?.id??"")+input("Categoría","category",x?.category)+input("Producto","productName",x?.name)+input("Descripción","productDescription",x?.description,"text",false)+input("Precio (S/)","price",x?(x.priceCents/100).toFixed(2):"")+select("Fotografía","photo",choices,x?.photo??""),"Guardar producto");
 html+='<h3>Catálogo inicial</h3>'+p.products.map(x=>'<article>'+productForm(x)+form("profile-edit",ver+h("operation","REMOVE")+h("productId",x.id),"Retirar producto")+'</article>').join("")+productForm(null);
 }
 html+='<h2>Vista previa de la ficha</h2><article>'+photo(p.logo)+'<h3>'+e(p.name)+'</h3><p>'+e(p.description)+'</p>'+days.map((d,i)=>'<p>'+d+': '+e(p.hours[i]?p.hours[i].open+"–"+p.hours[i].close:"Cerrado")+'</p>').join("")+p.products.map(x=>'<section><h3>'+e(x.category)+' · '+e(x.name)+'</h3>'+photo(x.photo)+'<p>'+e(x.description)+'</p><p>S/ '+(x.priceCents/100).toFixed(2)+'</p></section>').join("")+'</article>';
 if(!locked&&version>0&&!review)html+=form("profile-review",ver+input("Referencia de la conformidad o correcciones comunicadas por el comercio","evidence")+select("Decisión","decision",[["APPROVED","Conformidad del comercio"],["CORRECTIONS_REQUIRED","Solicitó correcciones"]]),"Registrar revisión");
 return html;
}
