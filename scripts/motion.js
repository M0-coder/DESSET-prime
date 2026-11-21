/* DESSET Prime | Progressive motion system.
 * V4.5 Kinetic Experience: entry, three-step concept, final contact.
 * Decorative, one-shot transitions only. No scroll trapping, timers, remote
 * dependencies, layout hiding, or auto-play video. */
"use strict";
(()=>{
 const root=document.documentElement;
 root.dataset.kineticVersion="v45";
 const cues=document.querySelectorAll(
  ".statement h2, .solutions .section-head, .ecosystem .section-head, "+
  ".motion-story, .motion-story-unit, .audiences .section-head, "+
  ".statement-side, .solutions-grid .service--main, .business-pitch, "+
  ".audience-grid--compact .audience, .contact-bottom--rc, "+
  ".contact, .closing-line"
 );
 if(!cues.length){root.dataset.motionSystem="empty";return}
 const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)").matches===true;
 if(reduced||typeof window.IntersectionObserver!=="function"){
  root.dataset.motionSystem=reduced?"reduced":"static";
  return;
 }
 root.dataset.motionSystem="ready";
 root.dataset.motionDirection="editorial-cinematic-v1";
 root.dataset.anim02="cinematic-chapters";
 const observer=new window.IntersectionObserver((entries,instance)=>{
  for(const entry of entries){
   if(!entry.isIntersecting)continue;
   entry.target.classList.add("motion-active");
   instance.unobserve(entry.target);
  }
 },{threshold:0.12,rootMargin:"0px 0px -3% 0px"});
 cues.forEach(el=>observer.observe(el));
})();
