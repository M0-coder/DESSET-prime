"use strict";
(()=>{
 const categories=[
  {
    "id": "alianzas",
    "title": "Alianzas y cooperación empresarial",
    "desc": "Propuestas de cooperación en tecnología e integraciones, transporte y distribución, abastecimiento y proyectos empresariales conjuntos. Se evaluarán según su viabilidad, responsabilidades y compatibilidad con las actividades de DESSET."
  },
  {
    "id": "inversion",
    "title": "Relaciones con inversionistas",
    "desc": "Consultas de potenciales inversionistas y socios estratégicos; no constituye una oferta de inversión."
  },
  {
    "id": "marketing",
    "title": "Marketing y publicidad",
    "desc": "Propuestas de campañas, patrocinios y colaboración publicitaria."
  },
  {
    "id": "prensa",
    "title": "Prensa y comunicaciones",
    "desc": "Solicitudes de información corporativa y relaciones con medios."
  },
  {
    "id": "instituciones",
    "title": "Relaciones gubernamentales e institucionales",
    "desc": "Comunicaciones de entidades públicas, privadas y organizaciones."
  },
  {
    "id": "profesionales",
    "title": "Oportunidades profesionales",
    "desc": "Consultas sobre futuras oportunidades; no se anuncian vacantes activas."
  },
  {
    "id": "legal",
    "title": "Asuntos legales y cumplimiento",
    "desc": "Correspondencia jurídica y asuntos de cumplimiento institucional."
  },
  {
    "id": "seguridad",
    "title": "Seguridad y privacidad",
    "desc": "Comunicaciones sobre protección de datos y seguridad de la información."
  },
  {
    "id": "otras",
    "title": "Otras consultas",
    "desc": "Correspondencia institucional que no encaje en las categorías anteriores."
  }
];
 const by=id=>document.getElementById(id);
 const dir=by("directorio"),view=by("form-view"),f=by("demo-form"),result=by("demo-result"),message=by("message"),count=by("count");
 const hero=document.querySelector(".ct-hero h1"),sub=document.querySelector(".ct-hero p");
 const reset=()=>{f.reset();f.hidden=false;result.hidden=true;count.textContent="0 / 2000 caracteres";};
 function route(){
  const key=location.hash.slice(1).replace(/^consulta-/,"");
  const item=categories.find(x=>x.id===key);
  reset();dir.hidden=Boolean(item);view.hidden=!item;
  hero.textContent=item?item.title:"Contacto institucional";
  sub.textContent=item?"Formulario de consulta institucional.":"Selecciona el área correspondiente a tu consulta.";
  if(item){
   by("crumb").textContent=item.title;by("form-desc").textContent=item.desc;
   by("org-label").textContent=item.id==="prensa"?"Medio de comunicación":"Empresa u organización";
   by("phone-field").hidden=!["prensa","alianzas","marketing","instituciones"].includes(item.id);
   by("phone").disabled=by("phone-field").hidden;
   by("org-field").hidden=["seguridad","otras","profesionales"].includes(item.id);
   by("org").disabled=by("org-field").hidden;
   by("aside-desc").textContent=item.id==="inversion"?"La consulta no constituye una oferta de inversión.":item.id==="profesionales"?"No se anuncian vacantes activas.":"Utiliza esta categoría para las consultas correspondientes al área seleccionada.";
   by("form-title").focus({preventScroll:true});
  }else if(key==="directorio"){dir.querySelector("a").focus({preventScroll:true});}
  window.scrollTo(0,0);
 }
 f.addEventListener("submit",event=>{
  event.preventDefault();
  if(view.hidden||!f.reportValidity())return;
  reset();f.hidden=true;result.hidden=false;result.focus();
 });
 message.addEventListener("input",()=>{count.textContent=message.value.length+" / 2000 caracteres";});
 window.addEventListener("hashchange",route);
 window.addEventListener("pagehide",reset);
 route();
 f.querySelector("button[type=submit]").disabled=false;
})();
