(() => {
  document.querySelectorAll('[data-watch]').forEach(button=>button.addEventListener('click',()=>{
    const id=button.dataset.watch;if(!/^[\w-]{11}$/.test(id))return;
    const box=document.getElementById('video-view');box.replaceChildren();
    const frame=document.createElement('iframe');const u=new URL('https://www.youtube-nocookie.com/embed/'+id);u.searchParams.set('autoplay','0');u.searchParams.set('playsinline','1');if(/^https?:$/.test(location.protocol))u.searchParams.set('origin',location.origin);frame.src=u.href;frame.title=button.innerText;frame.allow='encrypted-media; picture-in-picture; fullscreen';frame.allowFullscreen=true;frame.referrerPolicy='strict-origin-when-cross-origin';
    const link=document.createElement('a');link.href='https://www.youtube.com/watch?v='+id;link.target='_blank';link.rel='noopener noreferrer';link.textContent='YouTube ↗';
    const close=document.createElement('button');close.textContent='×';close.setAttribute('aria-label','Close');close.onclick=()=>{box.replaceChildren();box.hidden=true;};
    box.append(close,frame,link);box.hidden=false;box.scrollIntoView({block:'nearest',behavior:'smooth'});
  }));
})();
