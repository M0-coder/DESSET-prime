(() => {
  const v=document.querySelector('#desset-editorial-video'),b=document.querySelector('.desset-editorial-toggle');
  if(!v||!b)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let manuallyPaused=false,visible=true;
  function sync(){b.setAttribute('aria-label',v.paused?'Reproducir animación':'Pausar animación');b.firstElementChild.textContent=v.paused?'▶':'Ⅱ';}
  async function play(){if(reduced.matches||manuallyPaused||document.hidden||!visible)return;if(!v.getAttribute('src'))v.src=v.dataset.src;try{await v.play();if(reduced.matches||manuallyPaused||document.hidden||!visible){v.pause();return;}v.dataset.ready='true';b.hidden=false;sync();}catch{v.removeAttribute('data-ready');b.hidden=true;}}
  v.addEventListener('pause',sync);v.addEventListener('play',sync);
  v.addEventListener('error',()=>{v.removeAttribute('data-ready');b.hidden=true;});
  b.addEventListener('click',()=>{if(v.paused){manuallyPaused=false;void play();}else{manuallyPaused=true;v.pause();}sync();});
  reduced.addEventListener('change',()=>{if(reduced.matches){v.pause();v.removeAttribute('data-ready');b.hidden=true;}else void play();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)v.pause();else void play();});
  if(typeof IntersectionObserver==='function'){const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)void play();else v.pause();},{threshold:.1});observer.observe(v.parentElement);}
  else void play();
})();
