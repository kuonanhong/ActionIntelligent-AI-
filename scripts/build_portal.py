#!/usr/bin/env python3
"""Build dependency-free SmartAction landing pages. Python 3.9+."""
from pathlib import Path
import json,html,urllib.parse,re,xml.etree.ElementTree as ET
P=Path(__file__).resolve().parents[1]
def read_js(path):return json.JSONDecoder().raw_decode((P/path).read_text().split('=',1)[1].lstrip())[0]
D=read_js('assets/hub-locales.js'); A=read_js('assets/article-catalog.js'); V=read_js('assets/video-catalog.js')
BASE='https://kuonanhong.github.io/SmartAction/'
def e(s):return html.escape(str(s),quote=True)
def icon(n):
 paths=['<path d="M3 7h7l2 3h9v11H3zM3 7V4h7l2 3h9v3"/><path d="M8 16h8M12 12v8"/>','<path d="M6 8h12l3 10-3 2-4-4h-4l-4 4-3-2zM6 12h5M8.5 9.5v5M16 11v1M18 13v1"/>','<path d="m5 19 4-1L21 6l-4-4L5 14zM14 5l4 4M4 22h18"/>','<path d="M4 4h16v13H9l-5 4zM8 9h8M8 12h5"/>','<path d="M5 3h14v19H5zM8 7h8M8 11h8M8 15h3M13 15l2 2 3-4"/>']
 return '<svg viewBox="0 0 24 24" aria-hidden="true">'+paths[n]+'</svg>'
def head(lang,title,desc,path,root,alternate=False):
 alts=''.join(f'<link rel="alternate" hreflang="{l["code"]}" href="{BASE+("" if l["code"]=="zh-TW" else l["code"]+"/")}">' for l in D['languages']) if alternate else ''
 if alternate:alts+=f'<link rel="alternate" hreflang="x-default" href="{BASE}">'
 schema={'@context':'https://schema.org','@type':'WebPage','name':title,'description':desc,'url':BASE+path,'inLanguage':lang,'isPartOf':{'@type':'WebSite','name':'聰動成長協會｜巴金森知識與資源','url':BASE}}
 return f'''<!doctype html><html lang="{lang}" dir="{'rtl' if lang=='ar' else 'ltr'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin"><title>{e(title)}</title><meta name="description" content="{e(desc)}"><link rel="canonical" href="{BASE+path}">{alts}<meta property="og:type" content="website"><meta property="og:title" content="{e(title)}"><meta property="og:description" content="{e(desc)}"><meta property="og:url" content="{BASE+path}"><meta property="og:image" content="{BASE}社團法人高雄市聰動成長協會_files/999413_432036.png"><meta name="theme-color" content="#296758"><link rel="icon" href="{root}社團法人高雄市聰動成長協會_files/856889_768120.png"><link rel="stylesheet" href="{root}assets/hub.css"><script type="application/ld+json">{json.dumps(schema,ensure_ascii=False).replace('<','&lt;')}</script></head>'''
def header(t,root):
 return f'''<a href="#main" class="skip">Skip to content</a><header class="site-header"><a class="brand" href="{root}index.html"><img src="{root}社團法人高雄市聰動成長協會_files/856889_768120.png" width="46" height="46" alt=""><span><strong data-i18n="brand">{e(t['brand'])}</strong><small>SMARTACTION · KAOHSIUNG</small></span></a><nav class="main-nav" aria-label="Main"><a data-keep-lang href="{root}knowledge.html" data-i18n="navKnowledge">{e(t['navKnowledge'])}</a><a data-keep-lang href="{root}resources.html" data-i18n="navResources">{e(t['navResources'])}</a><a data-keep-lang href="{root}quiz.html" data-i18n="navQuiz">{e(t['navQuiz'])}</a><a href="{root}index.html#about" data-i18n="navAbout">{e(t['navAbout'])}</a></nav><label class="language"><span aria-hidden="true">◎</span><select id="language-select" aria-label="Language">{''.join('<option value="'+x['code']+'">'+x['name']+'</option>' for x in D['languages'])}</select></label></header>'''
def footer(t,root):return f'''<footer class="site-footer"><p data-i18n="footerNote">{e(t['footerNote'])}</p><a data-keep-lang href="{root}editorial.html">{'編輯與來源政策' if t is D['messages']['zh-TW'] else 'Sources & editorial policy'}</a><a href="{root}deployment.html">部署教學 / Setup</a></footer>'''
def scripts(root):return ''.join(f'<script src="{root}assets/{s}.js"></script>' for s in ['hub-locales','article-catalog','video-catalog','hub'])
for l in D['languages']:
 lang=l['code'];t=D['messages'][lang];zh=lang.startswith('zh');root='./' if lang=='zh-TW' else '../';path='' if lang=='zh-TW' else lang+'/'
 title=('聰動成長協會｜巴金森氏症知識、照顧與世界資源' if zh else t['brand']+' | Parkinson’s knowledge & support')
 desc=t['heroText']+' '+t['resourceIntro']+' '+t['quizTitle']
 def tr(k):return f'<span data-i18n="{k}">{e(t[k])}</span>'
 folders=''.join(f'<a class="folder-link" data-keep-lang href="{root}{url}">{icon(i)}{tr(key)}<span class="arrow" aria-hidden="true">↗</span></a>' for i,(key,url) in enumerate([('folderMarket','market/'),('folderPlay','play/'),('folderTools','tools/'),('folderAssistant','assistant/'),('folderQuiz','quiz.html')]))
 topics=[('Symptoms','symptoms','從動作與非動作症狀開始認識。','Explore movement and non-movement symptoms.'),('Diagnosis','diagnosis','整理就醫觀察，理解診斷的過程。','Prepare observations and understand assessment.'),('Treatment','treatment','認識照護選項，準備與醫師討論。','Understand care options and questions to ask.'),('Movement','movement','依自己的能力，尋找合適的活動。','Find activities suited to your abilities.'),('Care','care','從日常生活到病友與照顧者的支持。','Daily living, family and caregiver support.'),('Research','research','讀懂研究資訊，辨別宣稱與證據。','Understand research, claims and evidence.')]
 topic_html=''.join(f'<a class="topic-card" data-keep-lang href="{root}knowledge.html#{anchor}"><span class="topic-number">0{i+1} / KNOWLEDGE</span><h3>{tr("topic"+key)}</h3><p>{e(cn if zh else en)}</p><span class="topic-go">{e(t["startLearning"])} →</span></a>' for i,(key,anchor,cn,en) in enumerate(topics))
 articles=''.join(f'<a class="article-row-new" href="{root}{e(a["href"])}"><img class="article-icon" loading="lazy" width="41" height="41" alt="" src="{root}{e(a["image"])}"><h3>{e(a["title"])}</h3><span aria-hidden="true">↗</span></a>' for a in A[:6])
 extra='公益衛教・病友支持・高雄在地連結' if zh else 'Community education · Peer support · Kaohsiung'
 article_note='保留原始繁體中文文章與活動紀錄；部分頁面為摘要或待補資料。' if zh else 'Original Traditional Chinese articles and activity records. Some entries are summaries or await source recovery.'
 about_more='以非營利協會的服務精神，連結病友、家屬與照護資源。本站新增知識附上可查閱的來源；尚未經協會醫療團隊逐題審閱。' if zh else 'Connecting people with Parkinson’s, families and care resources through community service. New educational material includes sources and is awaiting clinical editorial review.'
 main=f'''<body data-page="home" data-root="{root}" data-locale-variant="{'false' if lang=='zh-TW' else 'true'}">{header(t,root)}<main id="main" class="wrap"><section class="hero"><div class="hero-copy"><p class="eyebrow">{tr('heroEyebrow')}</p><h1>{tr('tagline')}</h1><p>{tr('heroText')}</p><p style="font-size:12px">{e(extra)}</p><div class="hero-actions"><a class="button primary" data-keep-lang href="{root}knowledge.html">{tr('startLearning')} →</a><a class="button" data-keep-lang href="{root}resources.html">{tr('findResources')}</a></div></div><aside class="hero-aside"><img class="hero-photo" src="{root}社團法人高雄市聰動成長協會_files/999413_432036.png" width="520" height="215" alt="聰動成長協會會館" fetchpriority="high"><div class="hero-aside-bottom"><div><div class="tiny-label">SMARTACTION COMMUNITY</div><strong>{e(t['brand'])}</strong></div><span>KAOHSIUNG<br>TAIWAN ↗</span></div></aside></section><nav class="folder-strip" aria-label="{'聰動專區' if zh else 'SmartAction spaces'}">{folders}</nav><section class="knowledge-section"><div class="section-heading"><div><p class="eyebrow">LEARN & LIVE WELL</p><h2>{tr('knowledgeTitle')}</h2><p>{tr('knowledgeIntro')}</p></div></div><div class="knowledge-grid">{topic_html}</div></section><section class="quiz-banner"><div><h2>{tr('quizTitle')}</h2><p>{tr('quizText')}</p></div><a class="button" data-keep-lang href="{root}quiz.html">{tr('quizButton')} →</a></section><section class="two-columns"><div><div class="section-heading"><div><p class="eyebrow">FROM OUR COMMUNITY</p><h2>{tr('latestArticles')}</h2></div><a href="{root}blog/index.html">{tr('moreArticles')} ↗</a></div><div class="article-list" id="home-articles">{articles}</div><button id="more-articles" type="button" style="margin-top:16px">{e(t['moreArticles'])} (6 / 48)</button><p style="font-size:11px;color:var(--muted);margin:13px 0">{e(article_note)}</p></div><aside class="resource-preview"><p class="eyebrow">A WORLD OF SUPPORT</p><h2>{tr('resourceTitle')}</h2><p>{tr('resourceIntro')}</p><div class="big-stat">68 <span style="font-size:13px;font-weight:400">{tr('resourceCount')}</span></div><div class="resource-chips">{''.join('<span>'+e(t[k])+'</span>' for k in ['regionTaiwan','regionAsia','regionEurope','regionAmericas','regionGlobal','regionOceania'])}</div><p>{tr('sourcePolicy')}</p><a class="button primary" data-keep-lang href="{root}resources.html">{tr('findResources')} →</a></aside></section><section class="video-section"><div class="section-heading"><div><p class="eyebrow">STORIES & CONNECTIONS</p><h2>{tr('videoTitle')}</h2><p>{tr('videoIntro')}</p></div><a data-keep-lang href="{root}videos.html">{'14 部影片索引' if zh else '14-video index'} ↗</a></div><div class="video-grid" id="video-list"></div><noscript><a href="https://www.youtube.com/@%E8%81%B0%E5%8B%95%E6%88%90%E9%95%B7%E5%8D%94%E6%9C%83">YouTube</a></noscript></section><section class="about-box" id="about"><div><p class="eyebrow">PEOPLE, KNOWLEDGE, COMMUNITY</p><h2>{tr('aboutTitle')}</h2><p>{tr('aboutText')}</p><a href="https://www.smartaction.org.tw/" target="_blank" rel="noopener noreferrer">{tr('originalSite')} ↗</a></div><div><p>{e(about_more)}</p><a href="{root}association-original.html#section-f_4d301366-2038-4cbc-b926-b5c9762f11cd">{'保留的協會介紹' if zh else 'Archived association introduction'} →</a><p data-lang-note style="font-size:11px;margin:16px 0 0"></p></div></section>{footer(t,root)}</main>{scripts(root)}</body></html>'''
 dest=P/(path+'index.html');dest.parent.mkdir(exist_ok=True);dest.write_text(head(lang,title,desc,path,root,True)+main)
# Full video index uses only the verified set of links; no invented answer timestamps.
t=D['messages']['zh-TW'];root='./'
body=f'''<body data-page="videos" data-root="./">{header(t,root)}<main class="wrap" id="main"><section class="page-intro"><p class="eyebrow">SMARTACTION VIDEO LIBRARY</p><h1 data-i18n="videoTitle">聰動影音</h1><p data-i18n="videoIntro">從原始影片與文章延伸學習，依自己的步調觀看。</p><div class="notice">此處整理上傳網站中的 14 個不同影片連結，部分標題依文章標示。本次未能完整取得字幕，未聲稱逐一看完，也未編造答案秒數。播放由您主動啟動；若嵌入受限，請使用每張卡片的 YouTube 連結。<br>This is an index of 14 source links, not a verified transcript collection. Use each YouTube link if embedding is unavailable.</div><a class="button" target="_blank" rel="noopener noreferrer" href="https://www.youtube.com/@%E8%81%B0%E5%8B%95%E6%88%90%E9%95%B7%E5%8D%94%E6%9C%83" data-i18n="visitChannel">前往 YouTube 頻道</a></section><section id="video-list" class="video-grid" style="margin-bottom:40px"></section>{footer(t,root)}</main>{scripts(root)}</body></html>'''
(P/'videos.html').write_text(head('zh-TW','聰動影音｜14 部影片索引','聰動成長協會的紀錄片、活動與衛教影片連結。','videos.html','./')+body)
# Canonical entries for generated pages plus the original public article routes.
ET.register_namespace('','http://www.sitemaps.org/schemas/sitemap/0.9')
ns='{http://www.sitemaps.org/schemas/sitemap/0.9}';sm=ET.Element(ns+'urlset')
incomplete={a['path'] for a in json.loads((P/'assets/video-audit.json').read_text())['articles'] if a['status']=='placeholder_missing_full_text'}
paths=['']+[l['code']+'/' for l in D['languages'] if l['code']!='zh-TW']+['knowledge.html','resources.html','quiz.html','question-bank.html','en/question-bank.html','videos.html','editorial.html','play/','tools/','market/','assistant/','blog/index.html']+[a['href'] for a in A if a['href'] not in incomplete]
for path in dict.fromkeys(paths):
 u=ET.SubElement(sm,ns+'url');ET.SubElement(u,ns+'loc').text=BASE+urllib.parse.quote(path,safe='/');ET.SubElement(u,ns+'lastmod').text='2026-10-09'
ET.ElementTree(sm).write(P/'sitemap.xml',encoding='utf-8',xml_declaration=True)
(P/'robots.txt').write_text('User-agent: *\nAllow: /\nSitemap: '+BASE+'sitemap.xml\n')
(P/'.nojekyll').touch()
(P/'llms.txt').write_text('''# SmartAction — Parkinson education and community resources

> A community education portal associated with the uploaded materials of 社團法人高雄市聰動成長協會 (Kaohsiung SmartAction Growth Association). Educational content is not individual medical advice. New content awaits clinical editorial review.

- [Knowledge guides](https://kuonanhong.github.io/SmartAction/knowledge.html): sourced topic introductions.
- [Official resource directory](https://kuonanhong.github.io/SmartAction/resources.html): 68 selected resources; not an exhaustive directory.
- [100-question educational quiz](https://kuonanhong.github.io/SmartAction/quiz.html): 80 multiple-choice and 20 fill-in questions, Traditional Chinese and English, with source sections.
- [Source and editorial policy](https://kuonanhong.github.io/SmartAction/editorial.html): verification and translation limitations.
- [Association original website](https://www.smartaction.org.tw/)

There are 22 interface languages. This does not imply 22 complete medical translations. The video index does not contain verified transcripts or verified answer timestamps. Experimental offline AI output is not an authoritative medical or investment source. This file is an optional machine-readable guide and does not guarantee inclusion in AI answers.
''')
print('Built 22 home pages, video index, sitemap, robots and llms.txt')

# Static, printable question bank also works with JavaScript disabled.
Q=read_js('assets/knowledge-questions.js'); S=read_js('assets/knowledge-sources.js')
for lang,key,root,dest in [('zh-TW','zh-Hant','./','question-bank.html'),('en','en','../','en/question-bank.html')]:
 t=D['messages'][lang]; chinese=lang=='zh-TW'; items=[]
 for q in Q:
  options='<ol type="A">'+''.join('<li>'+e(o)+'</li>' for o in q['options'][key])+'</ol>' if q['type']=='choice' else '<p>'+('填空：________' if chinese else 'Fill in: ________')+'</p>'
  answer=q['options'][key][q['answer']] if q['type']=='choice' else ' / '.join(q['accepted'][key])
  links=[]
  for item in q['sources']:
   source=S[item['sourceId']];url=source['url'];url=url if url.startswith('http') else root+url
   links.append('<p>'+e(source['organization'])+' · '+e(item['section'])+'<br>'+e(item['locator'])+'</p><a class="button" href="'+e(url)+'" target="_blank" rel="noopener noreferrer">'+('開啟原始資料' if chinese else 'Open source')+' ↗</a>')
  items.append('<article class="reading-card" id="'+q['id']+'"><p class="eyebrow">'+q['id']+'</p><h2>'+e(q['question'][key])+'</h2>'+options+'<details><summary>'+('提示與答案' if chinese else 'Hint and answer')+'</summary><p>'+e(q['hint'][key])+'</p><p><strong>'+e(answer)+'</strong></p><p>'+e(q['explanation'][key])+'</p>'+''.join(links)+'</details><p style="margin-top:14px"><a href="'+root+'quiz.html?lang='+lang+'&amp;q='+q['id']+'">'+('互動作答' if chinese else 'Practice this question')+' →</a></p></article>')
 title='巴金森與聰動知識 100 題・閱讀版' if chinese else '100 Parkinson and SmartAction questions · Reading edition'
 note='本閱讀版完整列出100題，每題可展開提示、答案與來源。教育用途，尚待醫療團隊審閱；不是診斷工具。' if chinese else 'All 100 questions, with expandable answers and source locations. Educational material awaiting clinical editorial review; not a diagnostic tool.'
 page=head(lang,title,note,dest,root)+f'<body data-page="bank" data-root="{root}" data-locale-variant="true">'+re.sub(r'<label class="language">.*?</label>','',header(t,root))+'<main class="wrap" id="main"><section class="page-intro"><p class="eyebrow">READ · CHECK · LEARN</p><h1>'+e(title)+'</h1><p>'+e(note)+'</p><a class="button" href="'+root+'quiz.html?lang='+lang+'">'+('互動題庫' if chinese else 'Interactive quiz')+'</a> <a class="button" href="'+root+('en/question-bank.html' if chinese else 'question-bank.html')+'">'+('English' if chinese else '繁體中文')+'</a></section><div style="max-width:900px">'+''.join(items)+'</div>'+footer(t,root)+'</main></body></html>'
 (P/dest).write_text(page)
print('Built static bilingual question-bank pages')

(P/'社團法人高雄市聰動成長協會.html').write_bytes((P/'index.html').read_bytes())
# Preserve incomplete archive routes, while avoiding their promotion as full articles.
legacy_paths=list((P/'l').glob('*/index.html'))
for prefix in ['', 'en/', 'zh-CN/', 'ja/', 'fr/', 'es/']:
 for route in incomplete:
  candidate=P/(prefix+route)
  if candidate.exists():legacy_paths.append(candidate)
for candidate in legacy_paths:
 content=candidate.read_text()
 content=re.sub(r'<meta\b(?=[^>]*name=["\']robots["\'])[^>]*>', '', content, flags=re.I)
 content=content.replace('</head>','<meta name="robots" content="noindex,follow"></head>',1)
 candidate.write_text(content)
print('Preserved and noindexed',len(legacy_paths),'incomplete legacy overview/article pages')
