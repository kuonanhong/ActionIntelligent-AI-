(() => {
  const tr=text=>window.SmartActionLanguage?.tr(text)||text;
  const slides=[...document.querySelectorAll('.sa-park-slide')];
  if (slides.length<2) return;
  let current=0;
  const show=(i)=>{current=(i+slides.length)%slides.length;slides.forEach((s,n)=>{s.hidden=n!==current;s.setAttribute('aria-hidden',String(n!==current));});};
  const container=document.querySelector('.s-slider-section');
  const controls=document.createElement('div');controls.className='sa-slide-controls';
  let paused=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const previous=document.createElement('button');previous.type='button';previous.textContent=tr('上一張');previous.onclick=()=>show(current-1);
  const pause=document.createElement('button');pause.type='button';pause.textContent=paused?tr('播放輪播'):tr('暫停輪播');pause.onclick=()=>{paused=!paused;pause.textContent=paused?tr('播放輪播'):tr('暫停輪播');};
  const next=document.createElement('button');next.type='button';next.textContent=tr('下一張');next.onclick=()=>show(current+1);
  controls.append(previous,pause,next);container?.append(controls);
  setInterval(()=>{if(!paused&&!document.hidden&&!container?.matches(':hover'))show(current+1);},4200);
  show(0);
})();
