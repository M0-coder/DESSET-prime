"use strict";
const menu=document.querySelector(".menu-button");
const nav=document.querySelector(".main-nav");
if(menu&&nav){
 const triggers=[...(nav.querySelectorAll?.(".nav-expand")??[])];
 const closeSubmenus=(except=null)=>{
  for(const button of triggers)if(button!==except){button.setAttribute("aria-expanded","false");button.nextElementSibling.hidden=true;}
 };
 for(const button of triggers)button.addEventListener("click",()=>{
  const open=button.getAttribute("aria-expanded")!=="true";
  closeSubmenus(button);button.setAttribute("aria-expanded",String(open));button.nextElementSibling.hidden=!open;
 });
 document.addEventListener("click",event=>{if(triggers.length&&!nav.contains(event.target)&&!menu.contains(event.target))closeSubmenus();});
 const setOpen=(open)=>{
  menu.setAttribute("aria-expanded",String(open));
  menu.setAttribute("aria-label",open?"Menú — cerrar navegación":"Menú — abrir navegación");
  nav.dataset.open=String(open);
  if(!open)closeSubmenus();
 };
 menu.addEventListener("click",()=>setOpen(menu.getAttribute("aria-expanded")!=="true"));
 nav.addEventListener("click",event=>{if(event.target.closest("a"))setOpen(false)});
 document.addEventListener("keydown",event=>{
  if(event.key==="Escape"){
   const expanded=triggers.find(button=>button.getAttribute("aria-expanded")==="true");
   if(expanded){closeSubmenus();expanded.focus();return;}
   if(menu.getAttribute("aria-expanded")==="true"){setOpen(false);menu.focus();}
  }
 });
 // The no-JavaScript fallback remains visible until menu listeners exist.
 document.documentElement.classList.add("js-enabled");
}
