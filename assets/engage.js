/* Optional, visible and user-initiated. Never gates tools or manufactures views. */
(() => {
  'use strict';
  const script=document.currentScript;
  const base=new URL('../',script.src);
  const channel='https://www.youtube.com/@聰動成長協會';
  const tr=(k,f)=>window.SA_I18N?.tr(k,f)||f;
  const poolPromise=fetch(new URL('assets/videos.json',base)).then(r=>r.json()).catch(()=>({videos:[]}));
  function fill(container){
    container.classList.add('sa-engage');
    const title=document.createElement('h3');title.dataset.i18n='optionalSupport';title.dataset.en='Optional: discover SmartAction';title.textContent=tr('optionalSupport','自願支持：認識聰動協會');
    const note=document.createElement('p');note.dataset.i18n='noGate';note.dataset.en='Tools remain available without watching, subscribing or clicking. No hidden playback.';note.textContent=tr('noGate','不需觀看、訂閱或點擊即可使用工具；沒有隱藏播放或觀看獎勵。');
    const home=document.createElement('a');home.href=new URL('index.html?from=creative',base).href;home.textContent=tr('home','協會首頁');home.dataset.i18n='home';home.dataset.en='Association homepage';
    const random=document.createElement('button');random.type='button';random.textContent='YouTube · '+tr('support','自願觀看');random.setAttribute('aria-label','Choose a random SmartAction video');
    const all=document.createElement('a');all.href=channel;all.target='_blank';all.rel='noopener noreferrer';all.textContent='YouTube ↗';
    const player=document.createElement('div');player.hidden=true;player.setAttribute('aria-live','polite');
    const close=document.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Close video');
    random.addEventListener('click',async()=>{
      const pool=await poolPromise;const videos=(pool.videos||[]).filter(v=>/^[\w-]{11}$/.test(v.id));
      if(!videos.length){player.replaceChildren(all.cloneNode(true));player.hidden=false;return;}
      const video=videos[Math.floor(Math.random()*videos.length)];
      const frame=document.createElement('iframe');const u=new URL('https://www.youtube-nocookie.com/embed/'+video.id);u.searchParams.set('autoplay','0');u.searchParams.set('playsinline','1');if(/^https?:$/.test(location.protocol))u.searchParams.set('origin',location.origin);
      frame.src=u.href;frame.title=video.title;frame.referrerPolicy='strict-origin-when-cross-origin';frame.allow='fullscreen; picture-in-picture; encrypted-media';frame.allowFullscreen=true;
      const cap=document.createElement('p');cap.className='sa-video-caption';cap.textContent=video.title;
      const watch=document.createElement('a');watch.href='https://www.youtube.com/watch?v='+video.id;watch.textContent='YouTube ↗';watch.target='_blank';watch.rel='noopener noreferrer';
      player.replaceChildren(close,frame,cap,watch);player.hidden=false;
      document.dispatchEvent(new CustomEvent('smartaction:engagement',{detail:{action:'video-chosen',id:video.id}}));
    });
    close.addEventListener('click',()=>{player.replaceChildren();player.hidden=true;});
    home.addEventListener('click',()=>document.dispatchEvent(new CustomEvent('smartaction:engagement',{detail:{action:'home-link'}})));
    container.append(title,note,home,document.createTextNode(' · '),random,all,player);
  }
  document.querySelectorAll('[data-sa-engage]').forEach(fill);
})();
