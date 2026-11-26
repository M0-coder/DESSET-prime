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

  if(!stage && !contact){
    root.dataset.v5Mode="unavailable";
    return;
  }
  if(reduced || typeof window.IntersectionObserver!=="function"){
    root.dataset.v5Mode=reduced?"reduced":"static";
    const status=stage?.querySelector(".v65-load-status");
    if(status){status.textContent=reduced?"Movimiento reducido activado. La escena 3D permanece en pausa; desactiva esta preferencia y recarga para explorar el recorrido.":"Este navegador no admite la activación de la escena 3D. Se muestra la descripción alternativa.";status.hidden=false;}
    // Text-only fallback remains readable without motion, JavaScript, or IntersectionObserver.
    return;
  }

  const observer=new window.IntersectionObserver((entries,instance)=>{
    for(const entry of entries){
      if(!entry.isIntersecting) continue;
      entry.target.classList.add("v5-visible");
      instance.unobserve(entry.target);
    }
  },{threshold:0.12,rootMargin:"0px 0px 6% 0px"});

  if(stage)observer.observe(stage);
  if(contact)observer.observe(contact);
  root.classList.add("v5-motion-ready");
  root.dataset.v5Mode="ready";
  if(!stage)return;

  // Automatically load the actual 3D scene shortly before entering the viewport.
  const threeStart=stage.querySelector(".v6-enable-webgl");
  // Accessible image-free text stays visible while WebGL loads or when it is unsupported.
  if(threeStart)threeStart.hidden=false;
  const loadStatus=stage.querySelector(".v65-load-status");
  let webglRequested=false;
  const supportsWebGL=()=>{try{const gl=document.createElement("canvas").getContext("webgl2");if(!gl)return false;gl.getExtension("WEBGL_lose_context")?.loseContext();return true;}catch{return false;}};
  const showUnavailable=(message,mode="manual")=>{
    stage.dataset.v6Autostart=mode;
    stage.dataset.v64Requested="";
    webglRequested=false;
    if(loadStatus){loadStatus.textContent=message;loadStatus.hidden=false;}
    if(threeStart)threeStart.hidden=false;
  };
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
    showUnavailable("No se pudo iniciar o mantener la escena 3D. Puedes volver a intentarlo.");
  });
  const loadThree=(event)=>{
    if(webglRequested || stage.dataset.v6State==="active")return;
    if(event?.type==="click"){
      if(!supportsWebGL()){stage.dataset.v6State="unsupported";showUnavailable("WebGL2 no está disponible. Activa la aceleración gráfica del navegador o utiliza un navegador compatible y vuelve a intentarlo.","unsupported");return;}
      stage.dataset.v64Requested="tour";
    }
    webglRequested=true;
    stage.dataset.v6State="loading";
    if(threeStart)threeStart.hidden=true;
    if(loadStatus){loadStatus.textContent="Preparando los modelos 3D de DESSET…";loadStatus.hidden=false}
    const script=document.createElement("script");
    script.src="./assets/v6-three.bundle.js?scene=paper-v1";
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
      script.remove();
      showUnavailable("No se pudo descargar la escena 3D. Comprueba tu conexión y vuelve a intentarlo.");
    };
    document.head.appendChild(script);
  };
  threeStart?.addEventListener("click",loadThree);
  // No GPU probe on initial paint and no scroll listeners; observer fires when
  // the section is actually visible. Lower-end devices retain accessible static text.
  const canAutoStart=()=>navigator.connection?.saveData!==true&&
    (typeof navigator.deviceMemory!=="number"||navigator.deviceMemory>=4);
  const auto3D=canAutoStart();
  stage.dataset.v6Autostart=auto3D?"enabled":"manual";
  if(auto3D){
    const activationObserver=new window.IntersectionObserver((entries,self)=>{
      if(!entries.some(entry=>entry.isIntersecting&&entry.intersectionRatio>=0.12))return;
      self.disconnect();
      if(!supportsWebGL()){
        stage.dataset.v6State="unsupported";
        showUnavailable("WebGL2 no está disponible. Activa la aceleración gráfica del navegador o utiliza un navegador compatible y vuelve a intentarlo.","unsupported");
        return;
      }
      loadThree();
    },{rootMargin:"0px",threshold:0.12});
    activationObserver.observe(stage);
  }

  // ANIM-01: viewport-activated 3D remains independent of cursor-following ornaments.
})();
