/* DESSET Prime V5 | one-shot cinematic enhancements.
 * The visual narrative is fully readable without JS or with reduced motion.
 * No scroll listeners, tracking, timers, fetch calls or infinite animations. */
"use strict";
(()=>{
  const root=document.documentElement;
  const stage=document.querySelector(".v5-city-stage");
  const contact=document.querySelector("#contacto");
  const media=window.matchMedia?.("(prefers-reduced-motion: reduce)");
  const reduced=media?.matches===true;

  if(!stage || !contact){
    root.dataset.v5Mode="unavailable";
    return;
  }
  if(reduced || typeof window.IntersectionObserver!=="function"){
    root.dataset.v5Mode=reduced?"reduced":"static";
    return;
  }

  const observer=new window.IntersectionObserver((entries,instance)=>{
    for(const entry of entries){
      if(!entry.isIntersecting) continue;
      entry.target.classList.add("v5-visible");
      instance.unobserve(entry.target);
    }
  },{threshold:0.12,rootMargin:"0px 0px 6% 0px"});

  observer.observe(stage);
  observer.observe(contact);
  root.classList.add("v5-motion-ready");
  root.dataset.v5Mode="ready";

  const hero=document.querySelector(".v4-motion-canvas");
  const lens=hero?.querySelector(".v5-hero-refraction");
  if(!hero || !lens || window.matchMedia?.("(pointer: fine)").matches!==true) return;

  // Modest pointer response affects decoration only, not navigation or scroll.
  let frame=0;
  let dx=0;
  let dy=0;
  const paint=()=>{
    lens.style.setProperty("--v5-x",dx.toFixed(1)+"px");
    lens.style.setProperty("--v5-y",dy.toFixed(1)+"px");
    frame=0;
  };
  const update=(event)=>{
    const box=hero.getBoundingClientRect();
    dx=((event.clientX-box.left)/Math.max(box.width,1)-.5)*9;
    dy=((event.clientY-box.top)/Math.max(box.height,1)-.5)*7;
    if(!frame) frame=window.requestAnimationFrame(paint);
  };
  hero.addEventListener("pointermove",update,{passive:true});
  hero.addEventListener("pointerleave",()=>{
    if(frame) window.cancelAnimationFrame(frame);
    frame=0; dx=0; dy=0; paint();
  },{passive:true});
})();
