(() => {
  const v=document.querySelector('#desset-editorial-video');
  const copy=document.querySelector('#hero-messages');
  const control=document.querySelector('.hero-message-pause');
  if(!v||!copy||!control)return;
  // Exact cut points from the approved 10-second edit, not an independent timer.
  const cues=Array.from(copy.querySelectorAll('[data-at]'));
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let visible=true,userPaused=false,active=-1;
  function show(time){
    let index=0;
    for(let i=1;i<cues.length;i++)if(time>=Number(cues[i].dataset.at))index=i;
    if(index===active)return;
    active=index;
    cues.forEach((cue,i)=>cue.setAttribute('aria-hidden',String(i!==index)));
  }
  function syncControl(){
    const label=userPaused?'Reanudar mensajes y vídeo':'Pausar mensajes y vídeo';
    control.setAttribute('aria-label',label);
    control.title=label;
    control.textContent=userPaused?'▶':'Ⅱ';
  }
  function fallback(){v.removeAttribute('data-ready');control.hidden=true;show(0);}
  function allowed(){return !userPaused&&!reduced.matches&&!document.hidden&&visible;}
  async function play(){
    if(!allowed())return;
    if(!v.getAttribute('src'))v.src=v.dataset.src;
    try{
      await v.play();
      if(!allowed()){v.pause();return;}
      v.dataset.ready='true';control.hidden=false;show(v.currentTime);
    }catch{if(allowed())fallback();}
  }
  function update(){if(v.dataset.ready==='true'&&!reduced.matches)show(v.currentTime);}
  v.addEventListener('timeupdate',update);
  v.addEventListener('seeked',update);
  v.addEventListener('error',fallback);
  control.addEventListener('click',()=>{
    userPaused=!userPaused;syncControl();
    if(userPaused)v.pause();else void play();
  });
  reduced.addEventListener('change',()=>{
    if(reduced.matches){v.pause();fallback();userPaused=false;syncControl();}
    else void play();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)v.pause();else void play();});
  if(typeof IntersectionObserver==='function'){
    const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)void play();else v.pause();},{threshold:.1});
    observer.observe(v.parentElement);
  }else void play();
})();
