/* New overview/tool interfaces. Never claims to translate legacy clinical text. */
(() => {
  'use strict';
  const script = document.currentScript;
  const base = new URL('../', script?.src || new URL('assets/portal-i18n.js', location.href));
  const full = ['zh-TW','zh-CN','en','fr','ja','es'];
  const key = 'smartaction-language';
  let active = document.documentElement.dataset.portalLocale || '';
  let locales = [];
  let strings = {};
  const match = tag => {
    const value=String(tag||'').toLowerCase();
    if(value.startsWith('zh'))return /hans|cn|sg/.test(value)?'zh-CN':'zh-TW';
    const alias={no:'nb',tl:'fil',iw:'he',in:'id'}[value.split('-')[0]];
    return locales.find(l=>l.code.toLowerCase()===value || l.code===alias)?.code || locales.find(l=>value.startsWith(l.code.toLowerCase()+'-'))?.code || null;
  };
  const aliases={'drone.title':'drone','drone.eyebrow':'brain','drone.association':'home','drone.modeBeginner':'beginner','drone.modeNormal':'normal','drone.modeExpert':'expert','drone.cameraFpv':'firstPerson','drone.cameraThird':'thirdPerson','drone.pause':'pause','drone.reset':'reset','drone.helpTitle':'help'};
  function tr(id,fallback=''){const resolved=aliases[id]||id;return strings[resolved] || locales.find(l=>l.code==='en')?.strings[resolved] || fallback || id;}
  function apply(emit=true){
    if (!active.startsWith('zh')) document.querySelectorAll('[data-en]:not([data-i18n])').forEach(el=>{if(!el.dataset.fallback)el.dataset.fallback=el.textContent;el.textContent=el.dataset.en;});
    else document.querySelectorAll('[data-en]:not([data-i18n])').forEach(el=>{if(el.dataset.fallback)el.textContent=el.dataset.fallback;});
    document.querySelectorAll('[data-i18n]').forEach(el=>{
      const id=el.dataset.i18n;
      if(!el.dataset.fallback)el.dataset.fallback=el.textContent;
      const fallback=active.startsWith('zh')?el.dataset.fallback:(el.dataset.en||el.dataset.fallback);
      el.textContent=tr(id,fallback);
    });
    document.documentElement.lang=active;
    document.documentElement.dir=locales.find(l=>l.code===active)?.dir||'ltr';
    if(emit){document.dispatchEvent(new CustomEvent('sa:language',{detail:{locale:active}}));document.dispatchEvent(new CustomEvent('smartactionlanguage',{detail:{locale:active}}));}
  }
  function addMenu(){
    let select=document.querySelector('[data-sa-language]');
    if(!select){
      const bar=document.createElement('div');bar.className='sa-language-panel';
      const label=document.createElement('label');label.htmlFor='sa-tool-language';label.dataset.i18n='language';label.textContent='Language';
      select=document.createElement('select');select.id='sa-tool-language';select.dataset.saLanguage='';select.setAttribute('aria-label','Language');
      bar.append(label,select);document.body.prepend(bar);
    }
    select.replaceChildren();
    for(const locale of locales){const option=document.createElement('option');option.value=locale.code;option.textContent=locale.nativeName;select.append(option);}
    select.value=active;
    select.addEventListener('change',()=>{
      active=select.value;try{localStorage.setItem(key,active);}catch(_){}
      const url=new URL(location.href);url.searchParams.set('lang',active);
      if(document.documentElement.dataset.portalLocale){location.assign(new URL('l/'+active+'/index.html',base).href);return;}
      history.replaceState(null,'',url);strings=locales.find(l=>l.code===active)?.strings||{};apply();
    });
    if(!document.querySelector('.sa-translation-note')){const note=document.createElement('p');note.className='sa-translation-note';note.dataset.i18n='translationNotice';note.textContent='Translated overview and main controls; detailed text may fall back to English. The archive is available in six languages.';select.closest('.sa-language-panel')?.after(note);}
  }
  window.SA_I18N={tr,t:tr,apply:()=>apply(false),get locale(){return active;},base,ready:null};
  window.SA_I18N.ready=fetch(new URL('assets/portal-locales.json',base)).then(r=>{if(!r.ok)throw new Error('language data unavailable');return r.json();}).then(data=>{
    locales=data.locales;
    let saved='';try{saved=localStorage.getItem(key)||'';}catch(_){}
    const query=new URLSearchParams(location.search).get('lang');
    active=match(query)||match(active)||match(saved)||(navigator.languages||[navigator.language]).map(match).find(Boolean)||'en';
    strings=locales.find(l=>l.code===active)?.strings||{};addMenu();apply();
    document.querySelectorAll('[data-sa-home]').forEach(a=>{a.href=new URL(full.includes(active)?(active==='zh-TW'?'index.html':active+'/index.html'):'l/'+active+'/index.html',base).href;});
    return active;
  }).catch(()=>{active='zh-TW';document.documentElement.lang='zh-TW';return active;});
})();
