(() => {
  'use strict';
  const base=new URL('../',document.currentScript.src);
  fetch(new URL('assets/portal-locales.json',base)).then(r=>r.json()).then(data=>{
    const code=window.SmartActionLanguage?.locale||document.documentElement.lang||'zh-TW';
    const strings=data.locales.find(l=>l.code===code)?.strings||{};
    document.querySelectorAll('[data-sa-new]').forEach(el=>{if(strings[el.dataset.saNew])el.textContent=strings[el.dataset.saNew];});
    document.querySelectorAll('[data-sa-tool]').forEach(a=>{const u=new URL(a.href);u.searchParams.set('lang',code);a.href=u.href;});
    const bar=document.querySelector('.sa-language-bar');
    if(bar&&!bar.querySelector('.sa-brain-shortcut')){const a=document.createElement('a');a.className='sa-brain-shortcut';a.href=new URL('動動腦/index.html?lang='+encodeURIComponent(code),base).href;a.textContent=strings.brain||'動動腦';bar.append(a);}
  }).catch(()=>{});
})();
