(() => {
  const input=document.getElementById('article-search');
  if (!input) return;
  const rows=[...document.querySelectorAll('#article-list li')];
  const templates={'zh-TW':'共 {n} 筆','zh-CN':'共 {n} 条',en:'{n} articles',fr:'{n} articles',ja:'{n} 件の記事',es:'{n} artículos'};
  function filter(){
    const query=input.value.trim().toLocaleLowerCase();let count=0;
    rows.forEach(row=>{row.hidden=!row.textContent.toLocaleLowerCase().includes(query);if(!row.hidden)count++;});
    document.getElementById('article-count').textContent=(templates[document.documentElement.lang]||templates.en).replace('{n}',count);
  }
  input.addEventListener('input',filter);document.addEventListener('smartactionlanguage',filter);filter();
})();
