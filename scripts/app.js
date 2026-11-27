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

// Existing archive filters stay usable without script; hash deep links select the intended category.
if(typeof window!=="undefined"&&typeof document.getElementById==="function"){
 const categories=["nw-all","nw-press","nw-announcements","nw-media"];
 const selectNewsCategory=()=>{const id=window.location.hash.slice(1);if(categories.includes(id)){const input=document.getElementById(id);if(input?.type==="radio"&&input.name==="categoria")input.checked=true;}else if(id==="recursos-de-marca"){const item=document.getElementById(id);if(item?.tagName==="DETAILS")item.open=true;}};
 selectNewsCategory();window.addEventListener("hashchange",selectNewsCategory);
}

// VIDEO-03: continuous decorative loops while visible; no added visual controls.
if(typeof window!=="undefined"&&typeof document.querySelectorAll==="function"){
 const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)");
 for(const video of document.querySelectorAll("#soluciones .service-video, .apps-hero--video .apps-hero-video")){
  let visible=false;
  const sync=()=>{
   if(!visible||document.hidden||reduced?.matches){video.pause();return;}
   video.muted=true;video.loop=true;
   if(!video.getAttribute("src"))video.src=video.dataset.src;
   try{video.play()?.catch(()=>{});}catch{}
  };
  document.addEventListener("visibilitychange",sync);
  reduced?.addEventListener?.("change",sync);
  if(typeof window.IntersectionObserver==="function"){
   new window.IntersectionObserver(entries=>{visible=!!entries[0]?.isIntersecting;sync();},{threshold:.15}).observe(video);
  }
 }
}
