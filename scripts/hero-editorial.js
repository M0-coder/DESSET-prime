(() => {
  const v=document.querySelector('#desset-editorial-video');
  if(!v)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let visible=true;
  async function play(){if(reduced.matches||document.hidden||!visible)return;if(!v.getAttribute('src'))v.src=v.dataset.src;try{await v.play();if(reduced.matches||document.hidden||!visible){v.pause();return;}v.dataset.ready='true';}catch{v.removeAttribute('data-ready');}}
  v.addEventListener('error',()=>v.removeAttribute('data-ready'));
  reduced.addEventListener('change',()=>{if(reduced.matches){v.pause();v.removeAttribute('data-ready');}else void play();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)v.pause();else void play();});
  if(typeof IntersectionObserver==='function'){const observer=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)void play();else v.pause();},{threshold:.1});observer.observe(v.parentElement);}
  else void play();
})();
