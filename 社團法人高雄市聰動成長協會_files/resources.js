(() => {
  'use strict';
  const list = document.getElementById('resource-list');
  if (!list) return;
  const rows = [...list.querySelectorAll('.resource-row')];
  const input = document.getElementById('resource-search');
  const region = document.getElementById('resource-region');
  const kind = document.getElementById('resource-kind');
  const count = document.getElementById('resource-count');
  const templates = {'zh-TW':'共 {n} 個資源','zh-CN':'共 {n} 个资源',en:'{n} resources',fr:'{n} ressources',ja:'{n} 件のリソース',es:'{n} recursos'};
  function filter() {
    const query = input.value.trim().toLocaleLowerCase();
    let number = 0;
    rows.forEach(row => {
      row.hidden = !(row.textContent.toLocaleLowerCase().includes(query) && ((!region.value || region.value === 'all') || row.dataset.region === region.value) && ((!kind.value || kind.value === 'all') || row.dataset.kind === kind.value));
      if (!row.hidden) number++;
    });
    const locale = document.documentElement.lang;
    count.textContent = (templates[locale] || templates.en).replace('{n}', number);
  }
  [input,region,kind].forEach(el => el.addEventListener(el === input ? 'input':'change', filter));
  document.addEventListener('smartactionlanguage', filter);
  filter();
  const button = document.getElementById('resource-copy');
  button?.addEventListener('click', async () => {
    const status = document.getElementById('resource-copy-status');
    const messages = {'zh-TW':['連結已複製','請複製網址列的連結'],'zh-CN':['链接已复制','请复制地址栏的链接'],en:['Link copied','Copy the link from the address bar'],fr:['Lien copié','Copiez le lien dans la barre d’adresse'],ja:['リンクをコピーしました','アドレスバーのリンクをコピーしてください'],es:['Enlace copiado','Copie el enlace de la barra de direcciones']};
    const message = messages[document.documentElement.lang] || messages.en;
    try { await navigator.clipboard.writeText(location.href); status.textContent=message[0]; }
    catch (_) { status.textContent=message[1]; }
  });
})();
