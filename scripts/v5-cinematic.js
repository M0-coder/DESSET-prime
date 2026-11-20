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
    // On devices where 3D cannot be started, the link remains useful but
    // must not claim that WebGL will play.
    const link=document.querySelector("[data-v64-tour-launch]");
    if(link){
      link.setAttribute("aria-label","Ver recorrido ilustrado de DESSET");
      for(const node of link.childNodes){
        if(node.nodeType===3){node.textContent="Ver recorrido ilustrado ";break}
      }
    }
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
  // The original cinematic WebP remains the default visual on ALL devices.
  // WebGL is only fetched after the user's explicit click (hero or stage).
  if(threeStart)threeStart.hidden=false;
  const loadStatus=stage.querySelector(".v65-load-status");
  let webglRequested=false;
  const runRequestedTour=()=>{
    if(stage.dataset.v64Requested!=="tour" || stage.dataset.v6State!=="active")return;
    stage.dataset.v64Requested="";
    const tour=stage.querySelector(".v63-tour");
    if(tour?.getAttribute("aria-pressed")!=="true")
      stage.querySelector(".v63-tour")?.click();
  };
  stage.addEventListener("desset:v6-ready",()=>{
    if(loadStatus)loadStatus.hidden=true;
    webglRequested=false;
    runRequestedTour();
  });
  stage.addEventListener("desset:v6-unavailable",()=>{
    stage.dataset.v64Requested="";
    webglRequested=false;
    if(loadStatus)loadStatus.hidden=true;
    if(threeStart)threeStart.hidden=false;
  });
  const loadThree=()=>{
    if(webglRequested || stage.dataset.v6State==="active")return;
    webglRequested=true;
    stage.dataset.v6State="loading";
    if(threeStart)threeStart.hidden=true;
    if(loadStatus){loadStatus.textContent="Preparando los modelos 3D de DESSET…";loadStatus.hidden=false}
    const script=document.createElement("script");
    script.src="./assets/v6-three.bundle.js";
    script.async=true;
    // Three.js only signals READY after all three GLB models have been loaded
    // and an actual frame has been drawn. A script load alone is not ready.
    script.onload=()=>{
      webglRequested=false;
      runRequestedTour();
    };
    script.onerror=()=>{
      webglRequested=false;
      stage.dataset.v6State="fallback";
      stage.dataset.v64Requested="";
      if(loadStatus)loadStatus.hidden=true;
      if(threeStart)threeStart.hidden=false;
    };
    document.head.appendChild(script);
  };
  threeStart?.addEventListener("click",loadThree);

  // Primary-site integration: one intentional hero click opens the ecosystem
  // section and requests the actual GLB tour. Same explicit click is mobile
  // consent to load WebGL; reduced-motion visitors keep the static poster.
  document.querySelector("[data-v64-tour-launch]")?.addEventListener("click",()=>{
    if(stage.dataset.v6State==="active"){
      const tour=stage.querySelector(".v63-tour");
      if(tour?.getAttribute("aria-pressed")!=="true")tour?.click();
      return;
    }
    stage.dataset.v64Requested="tour";
    loadThree();
  });

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
