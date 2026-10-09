#!/usr/bin/env python3
"""Idempotent extension builder, standard library only. Run AFTER 重建網站.py."""
from pathlib import Path
from html import escape
import json, os, re
from urllib.parse import quote
SITE=Path(__file__).resolve().parents[1]
BASE='https://kuonanhong.github.io/SmartAction/'
FULL=['zh-TW','zh-CN','en','fr','ja','es']

def write(path,text):
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(text,encoding='utf-8')

def head(title,description,path,lang='zh-TW',kind='WebPage'):
    url=BASE+quote(path)
    meta={'@context':'https://schema.org','@type':kind,'name':title,'url':url,'description':description,'inLanguage':lang}
    if kind in ('SoftwareApplication','VideoGame'):
        meta.update(applicationCategory='EducationalApplication',operatingSystem='Web browser',offers={'@type':'Offer','price':'0','priceCurrency':'TWD'})
    return f'<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{escape(title)}</title><meta name="description" content="{escape(description)}"><meta name="referrer" content="strict-origin-when-cross-origin"><link rel="canonical" href="{url}"><meta property="og:title" content="{escape(title)}"><meta property="og:description" content="{escape(description)}"><meta property="og:url" content="{url}"><meta property="og:type" content="website"><script type="application/ld+json">{json.dumps(meta,ensure_ascii=False)}</script>'

def page(title,description,path,body,prefix='./'):
    return f'<!doctype html><html lang="zh-TW"><head>{head(title,description,path)}<link rel="stylesheet" href="{prefix}assets/portal.css"><script defer src="{prefix}assets/portal-i18n.js"></script><script defer src="{prefix}assets/engage.js"></script></head><body class="sa-creative"><header><a href="{prefix}index.html" data-sa-home>SMARTACTION · 聰動</a><nav><a href="{prefix}index.html" data-sa-home data-i18n="home">協會首頁</a><a href="{prefix}動動腦/index.html" data-i18n="brain">動動腦</a><a href="{prefix}resources.html" data-i18n="resources">巴金森資源</a></nav></header><main>{body}<div data-sa-engage></div></main><footer>SmartAction · <a href="https://www.smartaction.org.tw/">原協會網站</a> · <a href="{prefix}privacy.html">隱私與使用說明</a><p>技術展示站；互動工具不是醫療診斷、復健處方或飛行資格認證。</p></footer></body></html>'

def main():
    data=json.loads((SITE/'assets/portal-locales.json').read_text(encoding='utf-8'))
    locales=data['locales']
    registry=[{k:l[k] for k in ['code','nativeName','dir']} for l in locales]
    write(SITE/'assets/portal-registry.js','window.SA_LOCALE_REGISTRY='+json.dumps(registry,ensure_ascii=False)+';\n')
    old=(SITE/'index.html').read_text(encoding='utf-8')
    matches=re.findall(r'<iframe\b[^>]*data-youtube-id="([^"]+)"[^>]*>',old)
    videos=[]
    for tag in re.findall(r'<iframe\b[^>]*data-youtube-id="[^"]+"[^>]*>',old):
        vid=re.search(r'data-youtube-id="([^"]+)"',tag).group(1)
        title=re.search(r'title="([^"]+)"',tag)
        if vid not in [v['id'] for v in videos] and vid!='hGQP-BI_tws':
            videos.append({'id':vid,'title':title.group(1) if title else '聰動協會影片','source':'existing uploaded association homepage; owner should review publication/embedding rights'})
    write(SITE/'assets/videos.json',json.dumps({'channel':'https://www.youtube.com/@聰動成長協會','verifiedLive':False,'videos':videos},ensure_ascii=False,indent=2))
    for p in list(SITE.rglob('*.html')):
        rel=p.relative_to(SITE)
        if rel.parts[0] in ['l','動動腦'] or rel.name in ['videos.html','privacy.html']:continue
        s=p.read_text(encoding='utf-8')
        if 'data-page-locale=' not in s:continue
        prefix='../'*(len(rel.parts)-1)
        if 'assets/portal-registry.js' not in s:
            needle=re.search(r'<script[^>]*src="[^"]*language-data\.js[^>]*>',s)
            if needle:s=s[:needle.start()]+f'<script defer src="{prefix}assets/portal-registry.js?v=20261007"></script>'+s[needle.start():]
        s=re.sub(r'(language\.js)\?v=[^"\s]+',r'\1?v=20261007',s)
        if 'assets/portal-enhance.js' not in s:s=s.replace('</head>',f'<link rel="stylesheet" href="{prefix}assets/portal.css?v=20261007"><script defer src="{prefix}assets/portal-enhance.js?v=20261007"></script></head>')
        if rel.name in ['index.html','社團法人高雄市聰動成長協會.html'] and len(rel.parts)<=2:
            locale=(rel.parts[0] if len(rel.parts)>1 else 'zh-TW')
            strings=next((l['strings'] for l in locales if l['code']==locale),{})
            T=lambda k,f:escape(strings.get(k,f))
            section=f'''<section class="sa-home-tools" id="sa-creative-tools" data-no-translate><p class="sa-eyebrow">SMARTACTION / PLAY & CREATE</p><h2 data-sa-new="brain">{T('brain','動動腦・互動創作')}</h2><p data-sa-new="intro">{T('intro','一起探索社區學習、身體活動及巴金森資源。')}</p><div class="sa-grid"><article class="sa-card"><span class="sa-number">01 / FLIGHT</span><h3 data-sa-new="drone">{T('drone','免費網頁無人機模擬操控')}</h3><p>FPV · WASD + ↑↓←→ · Touch · Beginner / Expert</p><a class="sa-button" data-sa-tool data-sa-new="start" href="{prefix}動動腦/無人機模擬操控/index.html?lang={locale}">{T('start','開始')}</a></article><article class="sa-card"><span class="sa-number">02 / CREATE</span><h3 data-sa-new="video">{T('video','圖片與影片創作工作坊')}</h3><p data-sa-new="notGenerative">{T('notGenerative','本機動畫／調色不是生成式 AI；真正 AI 需另接後端。')}</p><a class="sa-button" data-sa-tool data-sa-new="start" href="{prefix}動動腦/AI由圖片生成影片/index.html?lang={locale}">{T('start','開始')}</a></article></div><a data-sa-tool data-sa-new="brain" href="{prefix}動動腦/index.html?lang={locale}">{T('brain','更多動動腦工具')}</a> · <a href="{prefix}videos.html">YouTube</a></section>'''
            if 'id="sa-creative-tools"' not in s:
                # Insert immediately after the opening main content section's first heading area.
                target=re.search(r'<li aria-label="(?:最新消息|Latest news|Actualités|最新情報|Noticias|最新消息)[^"]*"',s)
                if target:s=s[:target.start()]+'<li class="slide" aria-label="Play and create">'+section+'</li>'+s[target.start():]
                else:s=s.replace('</body>',section+'</body>')
            if locale=='zh-TW':
                desc='高雄聰動成長協會｜巴金森病友與照顧者資源、社區活動、免費網頁無人機模擬器、照片動態影片與 AI 影片創作入口。'
                s=re.sub(r'<meta\s+content="[^"]*"\s+name="description"\s*/?>',f'<meta name="description" content="{desc}">',s,count=1)
                s=s.replace('<title>社團法人高雄市聰動成長協會</title>','<title>聰動成長協會｜高雄巴金森資源・免費無人機模擬・影片創作</title>')
        write(p,s)
    brain='''<p class="sa-eyebrow">LEARN · PLAY · CREATE</p><h1 data-i18n="brain">動動腦・免費互動工作坊</h1><p class="sa-lead" data-i18n="intro">社區學習、身體活動與巴金森資源：讓不同世代一起學習、探索與創作。</p><div class="sa-grid"><article class="sa-card"><span class="sa-number">01 / FLIGHT LAB</span><h2 data-i18n="drone">免費網頁無人機模擬器</h2><p data-en="Practice with your keyboard or twin touch sticks. Assisted hover, three difficulty levels, FPV and third-person views. No installation required.">鍵盤或雙觸控搖桿即可練習。輔助懸停、三種難度、第一人稱與第三人稱視角，免安裝。</p><a class="sa-button" href="無人機模擬操控/index.html" data-i18n="start">開始</a></article><article class="sa-card"><span class="sa-number">02 / VIDEO LAB</span><h2 data-i18n="video">圖片與影片創作工作坊</h2><p data-i18n="notGenerative">免費本機照片動態動畫與影片調色，不是生成式 AI。真正生成式 AI 可另接自行提供的模型後端。</p><a class="sa-button" href="AI由圖片生成影片/index.html" data-i18n="start">開始</a></article></div><div class="sa-notice"><p data-i18n="noGate">所有工具可直接使用，不需觀看、訂閱或點擊；沒有隱藏播放或觀看獎勵。</p></div><h2>常見問題 / FAQ</h2><details><summary>手機需要升起虛擬鍵盤嗎？</summary><p>不需要。無人機頁提供雙手觸控搖桿；手機鍵盤無法可靠處理同時按住多鍵。</p></details><details><summary>這些互動工具能治療或復健巴金森病嗎？</summary><p>這是休閒學習工具，未進行臨床療效驗證，不是醫療建議或治療方案。復健安排請由醫療團隊評估。</p></details><details><summary>AI 影片是否完全免費且無限量？</summary><p>瀏覽器本機動畫與調色不收取 API 費。生成式影片模型需額外算力；自架會有硬體、電力與儲存成本，第三方試用通常有限額。</p></details><p><a href="../resources.html">高雄、台灣與國際巴金森資源</a> · <a href="../blog/index.html">協會文章與活動</a> · <a href="../videos.html">協會影音</a></p>'''
    write(SITE/'動動腦/index.html',page('動動腦｜免費網頁無人機模擬與照片影片創作・聰動協會','免費跨平台瀏覽器無人機練習、照片動態影片、影片調色及自架 AI 影片入口。免安裝，鍵盤與手機觸控可用。','動動腦/index.html',brain,'../'))
    overviewPaths=['l/'+l['code']+'/index.html' for l in locales]
    for l in locales:
        t=l['strings'];path='l/'+l['code']+'/index.html'
        canonical=BASE+quote(path)
        alternates=''.join(f'<link rel="alternate" hreflang="{x["code"]}" href="{BASE}l/{x["code"]}/index.html">' for x in locales)
        alternates+=f'<link rel="alternate" hreflang="x-default" href="{BASE}動動腦/index.html">'
        content=f'''<p class="sa-eyebrow">SMARTACTION · KAOHSIUNG · TAIWAN</p><h1>{escape(t['homepageTitle'])}</h1><p class="sa-lead">{escape(t['intro'])}</p><div class="sa-grid"><article class="sa-card"><span class="sa-number">01 / FLIGHT</span><h2>{escape(t['drone'])}</h2><a class="sa-button" href="../../動動腦/無人機模擬操控/index.html?lang={l['code']}">{escape(t['start'])}</a></article><article class="sa-card"><span class="sa-number">02 / CREATE</span><h2>{escape(t['video'])}</h2><p>{escape(t.get('notGenerative',t['translationNotice']))}</p><a class="sa-button" href="../../動動腦/AI由圖片生成影片/index.html?lang={l['code']}">{escape(t['start'])}</a></article></div><p>{escape(t['translationNotice'])}</p><p><a href="../../resources.html">{escape(t['resources'])} (繁體中文)</a> · <a href="../../en/resources.html">{escape(t['resources'])} (English)</a> · <a href="../../videos.html?lang={l['code']}">YouTube</a></p><h2>{escape(t['articles'])} · archive</h2><nav aria-label="Archive languages">{''.join(f'<a href="../../{("" if c=="zh-TW" else c+"/")}blog/index.html">{c}</a> · ' for c in FULL)}</nav>'''
        html=page(t['homepageTitle'],t['intro'],path,content,'../../').replace('<html lang="zh-TW">',f'<html lang="{l["code"]}" dir="{l["dir"]}" data-portal-locale="{l["code"]}">')
        html=html.replace('</head>',alternates+'</head>')
        # Landings are modest interface/overview translations, NOT mass medical pages.
        write(SITE/path,html)
    # The x-default hub reciprocates the same overview alternate set.
    hubPath=SITE/'動動腦/index.html'
    hub=hubPath.read_text(encoding='utf-8')
    links=''.join(f'<link rel="alternate" hreflang="{x["code"]}" href="{BASE}l/{x["code"]}/index.html">' for x in locales)
    links+=f'<link rel="alternate" hreflang="x-default" href="{BASE}動動腦/index.html">'
    write(hubPath,hub.replace('</head>',links+'</head>'))
    vbody='<p class="sa-eyebrow">WATCH · DISCOVER</p><h1>聰動協會影音 / SmartAction YouTube</h1><p class="sa-lead">由您主動選擇觀看；不自動播放、不強制解鎖，也不承諾計入觀看次數。</p><div class="sa-video-grid">'
    for i,v in enumerate(videos):vbody+=f'<button type="button" data-watch="{v["id"]}"><span class="sa-video-number">VIDEO {i+1:02}</span><h3>{escape(v["title"])}</h3>▶ YouTube</button>'
    vbody+='</div><div id="video-view" class="sa-engage" hidden></div><p>影片清單來自上傳的既有首頁；公開與嵌入權限由影片擁有者控制。若無法播放，可改在 YouTube 開啟。請協會管理者定期核對 assets/videos.json。</p>'
    videosHTML=page('聰動協會 YouTube 影音｜活動、學習與社區支持','由使用者主動選擇的聰動成長協會活動與衛教影片；無觀看獎勵、無隱藏播放。','videos.html',vbody)
    videosHTML=videosHTML.replace('</head>','<script defer src="assets/watch.js"></script></head>')
    write(SITE/'videos.html',videosHTML)
    privacy='''<h1>隱私與使用說明</h1><h2>本機互動工具</h2><p>無人機模擬在瀏覽器執行。照片動態動畫與影片調色使用本機檔案、Canvas 與 MediaRecorder；預設不會將媒體上傳。語言偏好保存在此裝置 localStorage，可清除網站資料重設。</p><h2>生成式 AI 選配後端</h2><p>只有您主動提供端點並送出 AI 工作時，檔案和提示詞才會送到您指定的服務。請確認服務提供者及其隱私政策，不要上傳病歷、身分證、未授權的人像或著作。自架端點預設只監聽本機；公開部署必須另加認證、配額、濫用防護及 HTTPS。</p><h2>YouTube</h2><p>新增的自願導流區只有在您點選影片按鈕後才載入 YouTube 隱私增強播放器，不自動播放。原站既有嵌入播放器保留其原行為。YouTube 會依自身政策處理資料及觀看紀錄；本站不能保证點擊計入觀看次數。無人機與創作工具不因觀看、訂閱、按讚或首頁點擊而解鎖。</p><h2>安全與授權</h2><p>模擬器是新製的教學級網頁實作，不是 Unity 或 PhoenixRC 的網頁轉換。沒有重製商用程式碼、模型、地景或破解安裝程式。模擬場景是程序化虛構地景，不是 Google Maps、街景、民航局飛行圖資或真實飛行環境，不可據此決定實際飛航安全或合法性。</p><h2>多語內容</h2><p>新增語系提供概要與主要操作標籤；詳細說明可能回退英文。既有文章全文版本仍為六語。圖片、影片字幕與外部網站不由本工具翻譯；機器輔助翻譯正式公開前應安排母語及醫療內容審閱。</p><h2>使用權限</h2><p>僅使用自己有權上傳與改作的媒體。不要製作未經同意的人像模仿、冒充醫療專家的內容、具誤導性的醫療宣稱或隱藏廣告。</p><p>2026-10-07 更新 · 此技術展示站保留原協會網站的官方入口。</p>'''
    write(SITE/'privacy.html',page('隱私與使用說明｜聰動互動工作坊','媒體預設本機處理；YouTube 自願觀看；AI 後端需使用者主動設定。', 'privacy.html',privacy))
    toolPages=[('動動腦/無人機模擬操控/index.html','免費網頁無人機模擬器｜FPV・键盤與手機雙搖桿｜聰動協會','免安裝的免費瀏覽器無人機操控練習：Mode 2鍵盤、手機雙觸控搖桿、三種難度、FPV及第三人稱視角。虛构地景，非飛行認證或醫療工具。','VideoGame'),('動動腦/AI由圖片生成影片/index.html','照片動態影片・影片調色與AI後端入口｜聰動創作工坊','免費本機照片平移縮放動畫、影片色彩濾鏡與下載；真正生成式AI圖轉影片、影片改作可連接自行提供的模型後端，不提供免費無限算力。','SoftwareApplication')]
    for path,title,description,kind in toolPages:
        toolPath=SITE/path
        if not toolPath.exists():continue
        html=toolPath.read_text(encoding='utf-8')
        html=re.sub(r'<title>.*?</title>',f'<title>{escape(title)}</title>',html,count=1,flags=re.S)
        html=re.sub(r'<meta\b[^>]*name="description"[^>]*>',f'<meta name="description" content="{escape(description)}">',html,count=1)
        if 'rel="canonical"' not in html:
            details=head(title,description,path,kind=kind)
            details=re.sub(r'<meta charset="utf-8">|<meta name="viewport"[^>]*>|<title>.*?</title>|<meta name="description"[^>]*>','',details)
            html=html.replace('</head>',details+'</head>')
        write(toolPath,html)
    sitemap=(SITE/'sitemap.xml').read_text(encoding='utf-8')
    sitemap=re.sub(r'<url><loc>'+re.escape(BASE)+r'(?:l/|%E5%8B%95%E5%8B%95%E8%85%A6/|videos\.html|privacy\.html).*?</url>','',sitemap,flags=re.S)
    urls=['動動腦/index.html','動動腦/無人機模擬操控/index.html','動動腦/AI由圖片生成影片/index.html','videos.html','privacy.html']+overviewPaths
    additions=''.join('<url><loc>'+BASE+quote(p)+'</loc></url>' for p in urls)
    sitemap=sitemap.replace('</urlset>',additions+'</urlset>');write(SITE/'sitemap.xml',sitemap)
    write(SITE/'維護工具/擴充驗證摘要.json',json.dumps({'date':'2026-10-07','localeOverviewCount':len(locales),'fullArchiveLocales':FULL,'randomVideoPoolCount':len(videos),'hiddenPlayback':False,'viewGating':False,'generativeBackendRequired':True},ensure_ascii=False,indent=2))
    print('Updated',len(locales),'language overview pages; kept six full archive locales; video pool',len(videos))

if __name__=='__main__':main()
