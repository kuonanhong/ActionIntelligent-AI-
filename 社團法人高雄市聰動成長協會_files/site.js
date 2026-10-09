(() => {
  "use strict";
  const tr = text => window.SmartActionLanguage?.tr(text) || text;
  const qs = (s) => document.querySelector(s);
  const menu = qs('.s-mobile-nav-bar');
  const drawer = qs('#mobile-navigation');
  function toggleMenu(open) {
    if (!menu || !drawer) return;
    drawer.classList.toggle('sa-open', open);
    menu.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-label', open ? tr('關閉選單') : tr('開啟選單'));
  }
  menu?.addEventListener('click', () => toggleMenu(menu.getAttribute('aria-expanded') !== 'true'));
  menu?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); menu.click(); }
  });
  drawer?.addEventListener('click', (e) => { if (e.target.closest('a')) toggleMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') toggleMenu(false); });
  document.addEventListener('click', (e) => {
    if (menu && drawer && !menu.contains(e.target) && !drawer.contains(e.target)) toggleMenu(false);
  });
  // The original page uses hash names, not a routing service.
  function goToHash() {
    let id = location.hash.slice(1);
    if (id === '1') id = '_1';
    if (!id) return;
    const element = document.getElementById(id);
    if (element) element.scrollIntoView({behavior:'auto', block:'start'});
  }
  window.addEventListener('hashchange', goToHash);
  if (location.hash) window.addEventListener('load', goToHash, {once:true});
  const visibleSections = [...document.querySelectorAll('li.slide')].filter(s => !s.hidden);
  const prev = qs('.navigation-buttons .prev');
  const next = qs('.navigation-buttons .next');
  function step(direction) {
    const current = visibleSections.reduce((best, el, i) => el.getBoundingClientRect().top <= 100 ? i : best, 0);
    const target = visibleSections[Math.max(0, Math.min(visibleSections.length-1, current+direction))];
    target?.scrollIntoView({behavior:'smooth'});
  }
  [[prev,-1,'上一區'],[next,1,'下一區']].forEach(([el,d,label]) => {
    if (!el) return;
    el.setAttribute('role','button'); el.setAttribute('tabindex','0'); el.setAttribute('aria-label',tr(label));
    el.addEventListener('click',() => step(d));
    el.addEventListener('keydown',e => { if(e.key==='Enter'||e.key===' ') {e.preventDefault(); step(d);} });
  });
  document.querySelectorAll('.sa-map-open').forEach(button => {
    button.addEventListener('click', () => {
      const container = button.closest('.sa-map');
      const frame = document.createElement('iframe');
      frame.title = tr('聰動成長協會互動地圖');
      frame.src = 'https://maps.google.com/maps?q=' + encodeURIComponent('高雄市三民區黃興路158巷8號') + '&output=embed';
      frame.loading = 'lazy';frame.referrerPolicy = 'no-referrer-when-downgrade';
      container.querySelector('a').replaceWith(frame); button.remove();
    });
  });
  const form = qs('#contact-form');
  const config = window.SmartActionConfig || {};
  if (form && config.contactEndpoint) {
    let url;
    try { url = new URL(config.contactEndpoint); } catch (_) { /* Use the email fallback. */ }
    if (url?.protocol === 'https:') {
      form.action = url.href; form.method = 'post'; form.target = '_blank';
      qs('#contact-submit').textContent = tr('送出');
      qs('#contact-note').textContent = tr('送出後將在新分頁顯示寄送結果。');
    }
  }
  form?.addEventListener('submit', (e) => {
    if (!form.reportValidity()) { e.preventDefault(); return; }
    const data = new FormData(form);
    if (data.get('website')) { e.preventDefault(); return; }
    if (form.method === 'post' && form.action.startsWith('https:')) return;
    e.preventDefault();
    const email = config.contactEmail || 'smartaction.service@gmail.com';
    const body = `${tr('姓名：')}${data.get('name')}\n${tr('電子信箱：')}${data.get('email')}\n${tr('連絡電話：')}${data.get('phone') || ''}\n\n${tr('您的訊息：')}\n${data.get('message')}`;
    const subject = tr('協會網站留言：') + String(data.get('name')).replace(/[\r\n]/g,' ');
    const mailto = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    location.href = mailto;
    const status = qs('#contact-status');
    status.textContent = tr('請在郵件程式中完成寄送。若郵件程式未開啟，可下載留言文字後寄至') + ' ' + email + '。';
    const download = document.createElement('a');
    const blob = new Blob([`${tr('收件者：')}${email}\n${tr('主旨：')}${subject}\n\n${body}`],{type:'text/plain;charset=utf-8'});
    download.href = URL.createObjectURL(blob); download.download = '協會留言.txt';download.textContent = tr('下載留言文字');
    download.className = 'sa-message-download';status.append(document.createElement('br'),download);
  });
})();
