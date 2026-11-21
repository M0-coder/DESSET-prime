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
    // Static poster remains accessible when reduced motion or IntersectionObserver is unavailable.
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

  // Automatically load the actual 3D scene shortly before entering the viewport.
  const threeStart=stage.querySelector(".v6-enable-webgl");
  // WebP is only a temporary loading/failure fallback, not the main visual.
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
    stage.dataset.v6Autostart="manual";
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
      stage.dataset.v6Autostart="manual";
      if(threeStart)threeStart.hidden=false;
    };
    document.head.appendChild(script);
  };
  threeStart?.addEventListener("click",loadThree);
  // No GPU probe on initial paint and no scroll listeners; observer fires when
  // the section is actually visible. Lower-end devices keep a useful still.
  const canAutoStart=()=>navigator.connection?.saveData!==true&&
    (typeof navigator.deviceMemory!=="number"||navigator.deviceMemory>=4);
  const auto3D=canAutoStart();
  stage.dataset.v6Autostart=auto3D?"enabled":"manual";
  if(auto3D){
    const activationObserver=new window.IntersectionObserver((entries,self)=>{
      if(!entries.some(entry=>entry.isIntersecting&&entry.intersectionRatio>=0.12))return;
      self.disconnect();
      try{
        if(!document.createElement("canvas").getContext("webgl2")){
          stage.dataset.v6Autostart="unsupported";
          if(threeStart)threeStart.hidden=true;
          return;
        }
      }catch{
        stage.dataset.v6Autostart="unsupported";
        if(threeStart)threeStart.hidden=true;
        return;
      }
      loadThree();
    },{rootMargin:"0px",threshold:0.12});
    activationObserver.observe(stage);
  }

  // ANIM-01: decorative lens stays still. No cursor-following game interaction.
})();
