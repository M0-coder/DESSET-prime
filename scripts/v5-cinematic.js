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

  // Real 3D is deliberately lazy: no 3D package request on mobile until explicit opt-in.
  // Desktop receives the script only when the scene intersects the viewport.
  const threeStart=stage.querySelector(".v6-enable-webgl");
  const mobile=window.matchMedia?.("(max-width: 800px)")?.matches===true;
  if(threeStart && mobile)threeStart.hidden=false;
  let webglRequested=false;
  const loadThree=()=>{
    if(webglRequested || stage.dataset.v6State==="active")return;
    webglRequested=true;
    stage.dataset.v6State="loading";
    const script=document.createElement("script");
    script.src="./assets/v6-three.bundle.js";
    script.async=true;
    script.onload=()=>{webglRequested=false};
    script.onerror=()=>{
      webglRequested=false;
      stage.dataset.v6State="fallback";
      if(threeStart)threeStart.hidden=false;
    };
    document.head.appendChild(script);
  };
  threeStart?.addEventListener("click",loadThree);
  if(!mobile){
    const trigger3D=new window.IntersectionObserver((entries,instance)=>{
      if(!entries.some(e=>e.isIntersecting))return;
      instance.disconnect();loadThree();
    },{threshold:.1,rootMargin:"0px 0px 22% 0px"});
    trigger3D.observe(stage);
  }

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
