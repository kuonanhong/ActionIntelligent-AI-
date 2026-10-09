(() => {
  'use strict';
  const root = document.documentElement;
  const complete = ['zh-TW', 'zh-CN', 'en', 'fr', 'ja', 'es'];
  const registry = window.SA_LOCALE_REGISTRY || complete.map(code => ({code,nativeName:code}));
  const supported = registry.map(item => item.code);
  const storageKey = 'smartaction-language';
  const config = window.SmartActionI18n || {translations:{}};
  const explicit = root.dataset.pageLocale || 'zh-TW';
  const isVariant = root.dataset.localeVariant === 'true';
  function matchLanguage(tag) {
    const value = String(tag || '').toLowerCase();
    if (value.startsWith('zh')) return /hans|cn|sg/.test(value) ? 'zh-CN' : 'zh-TW';
    const alias = {no:'nb',tl:'fil',iw:'he',in:'id'}[value.split('-')[0]];
    return supported.find(code => value === code.toLowerCase() || value.startsWith(code.toLowerCase() + '-') || code === alias) || null;
  }
  function preferredLanguage() {
    for (const tag of navigator.languages || [navigator.language]) {
      const value = matchLanguage(tag);
      if (value) return value;
    }
    return 'en';
  }
  let saved;
  try { saved = localStorage.getItem(storageKey); } catch (_) {}
  const query = new URLSearchParams(location.search).get('lang');
  let selected = isVariant ? explicit : matchLanguage(query) || matchLanguage(saved) || preferredLanguage();
  if (!complete.includes(selected)) {
    if (!isVariant && ['index.html','社團法人高雄市聰動成長協會.html'].includes(root.dataset.pagePath || 'index.html')) {
      location.replace(new URL('l/' + selected + '/index.html',new URL(root.dataset.siteRoot || './',location.href)).href);
      return;
    }
    // Do not mislabel untranslated archive text as a new language.
    selected = explicit;
  }
  const dictionaries = config.translations || {};
  const dictionary = dictionaries[selected] || {};
  const tr = text => dictionary[text] || text;
  window.SmartActionLanguage = {locale:selected, tr, matchLanguage};
  if (!isVariant && selected !== 'zh-TW') {
    const walker = document.createTreeWalker(document, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      if (node.parentElement?.closest('script,style,[data-no-translate]')) return;
      const text = node.nodeValue.trim();
      if (dictionary[text]) node.nodeValue = node.nodeValue.replace(text, dictionary[text]);
    });
    document.querySelectorAll('[alt],[title],[placeholder],[aria-label]').forEach(el => {
      if (el.closest('[data-no-translate]')) return;
      for (const attribute of ['alt','title','placeholder','aria-label']) {
        const value = el.getAttribute(attribute);
        if (value && dictionary[value.trim()]) el.setAttribute(attribute, dictionary[value.trim()]);
      }
    });
    const description = document.querySelector('meta[name="description"]');
    if (description && dictionary[description.content]) description.content = dictionary[description.content];
  }
  root.lang = selected;
  root.dataset.activeLocale = selected;
  const translationNote = document.querySelector('.sa-locale-note');
  if (translationNote) translationNote.hidden = selected === 'zh-TW';
  function positionNavigation() {
    const barHeight = document.querySelector('.sa-language-bar')?.offsetHeight || 56;
    const noteHeight = translationNote?.offsetHeight || 0;
    const noticeHeight = document.querySelector('.sa-demo-notice')?.offsetHeight || 0;
    root.style.setProperty('--sa-language-height', barHeight + 'px');
    root.style.setProperty('--sa-notice-top', (barHeight + noteHeight) + 'px');
    root.style.setProperty('--sa-navigation-top', (barHeight + noteHeight + noticeHeight) + 'px');
  }
  positionNavigation();
  window.addEventListener('resize', positionNavigation);
  const selector = document.getElementById('sa-language-select');
  if (selector) {
    for (const locale of registry) {
      if (selector.querySelector('option[value="' + locale.code + '"]')) continue;
      const option = document.createElement('option'); option.value = locale.code;
      option.textContent = locale.nativeName + ' · overview'; option.dataset.noTranslate = '';
      selector.append(option);
    }
    selector.value = selected;
    selector.addEventListener('change', () => {
      let choice = selector.value;
      if (choice === 'auto') {
        try { localStorage.removeItem(storageKey); } catch (_) {}
        choice = preferredLanguage();
      } else { try { localStorage.setItem(storageKey, choice); } catch (_) {} }
      const base = new URL(root.dataset.siteRoot || './', location.href);
      const page = root.dataset.pagePath || 'index.html';
      const prefix = choice === 'zh-TW' ? '' : choice + '/';
      const destination = new URL(complete.includes(choice) ? prefix + page : 'l/' + choice + '/index.html', base);
      destination.hash = location.hash;
      location.assign(destination.href);
    });
  }
  // In the automatic entry, make every internal navigation keep the chosen language.
  if (!isVariant && selected !== 'zh-TW') {
    const base = new URL(root.dataset.siteRoot || './', location.href);
    document.querySelectorAll('a[data-page-target]').forEach(link => {
      const original = new URL(link.href, location.href);
      const destination = new URL(selected + '/' + link.dataset.pageTarget, base);
      destination.hash = original.hash;
      link.href = destination.href;
    });
  }
  document.dispatchEvent(new CustomEvent('smartactionlanguage', {detail:{locale:selected}}));
})();
