"use strict";
const menu=document.querySelector(".menu-button");
const nav=document.querySelector(".main-nav");
if(menu&&nav){
 const setOpen=(open)=>{
  menu.setAttribute("aria-expanded",String(open));
  menu.setAttribute("aria-label",open?"Cerrar navegación":"Abrir navegación");
  nav.dataset.open=String(open);
 };
 menu.addEventListener("click",()=>setOpen(menu.getAttribute("aria-expanded")!=="true"));
 nav.addEventListener("click",event=>{if(event.target.closest("a"))setOpen(false)});
 document.addEventListener("keydown",event=>{
  if(event.key==="Escape"&&menu.getAttribute("aria-expanded")==="true"){
   setOpen(false);menu.focus();
  }
 });
 // The no-JavaScript fallback remains visible until menu listeners exist.
 document.documentElement.classList.add("js-enabled");
}
