from pathlib import Path
from bs4 import BeautifulSoup, NavigableString, Comment
from opencc import OpenCC
import json, re, posixpath, copy, csv, html, hashlib
from urllib.parse import urlsplit, urlunsplit, unquote, quote

ROOT = Path(__file__).resolve().parent
SITE = ROOT.parent
ASSETS = '社團法人高雄市聰動成長協會_files'
BASE = 'https://kuonanhong.github.io/SmartAction/'
LOCALES = ['zh-TW','zh-CN','en','fr','ja','es']
CC = OpenCC('t2s')

def readjson(p): return json.loads(p.read_text(encoding='utf-8'))
def soup(text): return BeautifulSoup(text,'html.parser')
def fragment(text): return soup(text)
def translated(source, locale, dictionaries):
    if locale=='zh-CN': return CC.convert(source)
    return dictionaries.get(locale,{}).get(source,source)

def catalogue():
    records=[]
    for r in readjson(ROOT/'來源資料/resources-taiwan.json')['records']:
        record={k:r[k] for k in ['id','region','country','kind','languages','url']}
        record['title']={('zh-TW' if l=='zh' else l):v for l,v in r['title'].items()}
        record['description']={('zh-TW' if l=='zh' else l):v for l,v in r['description'].items()}
        record.update(checkedDate=r['checkedDate'],verification='official-page-retrieved')
        records.append(record)
    for r in readjson(ROOT/'來源資料/resources-international.json'):
        record={k:r[k] for k in ['id','region','country','kind','languages','url']}
        # Keep official organization names as proper names; translate the Japanese label.
        name=r['name']
        record['title']={l:name for l in ['zh-TW','en','fr','ja','es']}
        if r['id']=='jpda-branches':
            record['title'].update({'zh-TW':'日本全國巴金森病友會｜各地分會','en':'Japan Parkinson’s Disease Association · Local branches','fr':'Association japonaise des personnes atteintes de Parkinson · Sections locales','ja':'全国パーキンソン病友の会・各地の支部','es':'Asociación Japonesa de la Enfermedad de Parkinson · Delegaciones locales'})
        if r['id']=='france-parkinson-comites':
            record['title']={'zh-TW':'France Parkinson｜地方分會','en':'France Parkinson · Local chapters','fr':'France Parkinson · Comités locaux','ja':'France Parkinson・地域の支部','es':'France Parkinson · Delegaciones locales'}
        elif r['id']=='france-parkinson-professionnels':
            record['title']={'zh-TW':'France Parkinson｜專業資源','en':'France Parkinson · Professional resources','fr':'France Parkinson · Ressources professionnelles','ja':'France Parkinson・専門職向け情報','es':'France Parkinson · Recursos para profesionales'}
        record['description']=r['description_i18n']
        record.update(checkedDate=r['check_date'],verification=r['verification'])
        records.append(record)
    for r in records:
        for k in ['title','description']: r[k]['zh-CN']=CC.convert(r[k]['zh-TW'])
    return records

KINDS={'care':'醫療與照護','support':'病友支持','education':'衛教資訊','research':'研究與試驗','professional':'專業學會'}
REGIONS={'kaohsiung':'高雄','taiwan':'台灣','international':'國際'}
LANGNAMES={'zh-Hant':'繁體中文','zh-TW':'繁體中文','zh-Hans':'簡體中文','zh-CN':'簡體中文','zh':'繁體中文','en':'英語','fr':'法語','ja':'日語','es':'西班牙語','de':'德語','it':'義大利語','pt':'葡萄牙語','multiple':'多種語言'}
SYMBOLS={'care':'✚','support':'♥','education':'📖','research':'🔬','professional':'◎'}

def resources_html(records):
    rows=[]
    for r in records:
        title=html.escape(r['title']['zh-TW']); desc=html.escape(r['description']['zh-TW']);url=html.escape(r['url'],quote=True)
        langs='、'.join(LANGNAMES.get(x,x) for x in r['languages'])
        langhtml=' · '.join('<span>'+html.escape(LANGNAMES.get(x,x))+'</span>' for x in r['languages'])
        note='<p class="resource-meta">本次以官方搜尋索引查核，頁面直接讀取受限。</p>' if r['verification']=='official-search-index-only' else ''
        rows.append(f'<li class="resource-row" data-region="{r["region"]}" data-kind="{r["kind"]}" id="{r["id"]}"><span class="resource-symbol" aria-hidden="true">{SYMBOLS[r["kind"]]}</span><div><h2><a class="resource-title" href="{url}" target="_blank" rel="noopener noreferrer">{title}</a></h2><p>{desc}</p><p class="resource-meta"><span>{REGIONS[r["region"]]}</span> · <span>{KINDS[r["kind"]]}</span> · <span>來源語言</span>：{langhtml}</p>{note}<a href="{url}" target="_blank" rel="noopener noreferrer">官方網站</a></div></li>')
    return f'''<!doctype html><html lang="zh-TW"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>巴金森資源目錄｜聰動成長協會</title><link rel="icon" href="./{ASSETS}/856889_768120.png"><link rel="stylesheet" href="./{ASSETS}/archive.css"><link rel="stylesheet" href="./{ASSETS}/resources.css"><script defer src="./{ASSETS}/resources.js"></script></head><body><header><a class="brand" href="./index.html"><img src="./{ASSETS}/856889_768120.png" alt="聰動成長協會">社團法人高雄市聰動成長協會</a><nav><a href="./index.html">首頁</a><a href="./blog/index.html">部落格</a><a href="./parkinson.html">巴金森手記</a></nav></header><main><h1>高雄、台灣與國際巴金森資源</h1><p class="resource-intro">依地區與用途整理官方醫療、病友支持、衛教及研究入口，幫助您找到需要的資訊。</p><p class="resource-meta"><span>查核日期</span>：2026-10-06</p><div class="resource-actions"><button type="button" id="resource-copy">複製本頁連結</button><span id="resource-copy-status" role="status"></span></div><div class="resource-controls"><label><span>搜尋資源</span><input type="search" id="resource-search" placeholder="輸入機構、主題或關鍵字"></label><label><span>地區</span><select id="resource-region"><option value="all">全部地區</option>{''.join(f'<option value="{k}">{v}</option>' for k,v in REGIONS.items())}</select></label><label><span>用途</span><select id="resource-kind"><option value="all">全部用途</option>{''.join(f'<option value="{k}">{v}</option>' for k,v in KINDS.items())}</select></label></div><p id="resource-count" aria-live="polite"></p><ul class="resource-list" id="resource-list">{''.join(rows)}</ul><p class="resource-note">本目錄為持續擴充的精選資源，並非全球所有網站的完整清單。外部網站由各機構維護；醫療問題請洽您的醫療團隊。</p><p>相關單位的服務與報名方式，請以連結內最新公告為準。</p></main><footer><a href="./index.html">回到首頁</a><p>社團法人高雄市聰動成長協會 · 07-392-0873</p><a href="mailto:smartaction.service@gmail.com">smartaction.service@gmail.com</a></footer></body></html>'''


def common(doc, page):
    for el in doc.select('.sa-language-bar,.sa-locale-note'): el.decompose()
    for text in doc.find_all(string=lambda s: s and '技術展示與測試站' in s):
        if text.parent.name=='div':
            text.parent['class']=list(set(text.parent.get('class',[])+['sa-demo-notice']))
    for el in doc.select('script[data-sa-i18n],link[data-sa-i18n]'): el.decompose()
    bar=fragment('''<div class="sa-language-bar" role="region" aria-label="網站語言"><label for="sa-language-select">網站語言</label><select id="sa-language-select" aria-label="網站語言"><option value="auto">自動選擇（依瀏覽器）</option><option value="zh-TW" data-no-translate>繁體中文</option><option value="zh-CN" data-no-translate>简体中文</option><option value="en" data-no-translate>English</option><option value="fr" data-no-translate>Français</option><option value="ja" data-no-translate>日本語</option><option value="es" data-no-translate>Español</option></select><a class="sa-resource-shortcut" href="resources.html">巴金森資源</a></div><p class="sa-locale-note" hidden>翻譯版供閱讀輔助；圖片內文字、影片字幕與外部網站保留原語言。</p>''')
    for el in reversed(list(bar.contents)):doc.body.insert(0,el)
    # URLs written relative to the original page here; the rewriting pass resolves them.
    depth=len(Path(page).parts)-1
    prefix='../'*depth
    doc.select_one('.sa-resource-shortcut')['href']=prefix+'resources.html'
    for filename in ['language.css','resources.css']:
        if filename=='resources.css' and doc.find('link',href=re.compile('resources.css')):continue
        doc.head.append(doc.new_tag('link',rel='stylesheet',href=prefix+ASSETS+'/'+filename,attrs={'data-sa-i18n':''}))
    first=doc.find('script')
    for filename in ['language-data.js','language.js']:
        tag=doc.new_tag('script',src=prefix+ASSETS+'/'+filename,attrs={'defer':'','data-sa-i18n':''})
        if first:first.insert_before(tag)
        else:doc.head.append(tag)
    # Add a crawlable language menu alongside the selector, without mixing prose.
    old=doc.select_one('#sa-language-links')
    if old:old.decompose()
    links=doc.new_tag('div',id='sa-language-links',attrs={'class':'sa-language-links','data-no-translate':''})
    for l,label in [('zh-TW','繁中'),('zh-CN','简中'),('en','EN'),('fr','FR'),('ja','日本語'),('es','ES')]:
        href=prefix+('' if l=='zh-TW' else l+'/')+page
        a=doc.new_tag('a',href=href,hreflang=l);a.string=label;links.append(a)
    doc.select_one('.sa-language-bar').append(links)
    return doc

def relative_url(value, source, destination, locale, htmlpaths):
    u=urlsplit(value)
    if u.scheme or u.netloc or value.startswith('#') or not u.path:return value
    target=posixpath.normpath(posixpath.join(posixpath.dirname(source),unquote(u.path)))
    if target=='.':target='index.html'
    elif u.path.endswith('/'):target=target.rstrip('/')+'/index.html'
    # Do not localize language-switch links, which already encode an explicit locale.
    language_target=target
    explicit_target=next((l for l in LOCALES[1:] if target.startswith(l+'/')),None)
    if target in htmlpaths:
        language_target=('' if locale=='zh-TW' else locale+'/')+target
    newpath=posixpath.relpath(language_target,posixpath.dirname(destination) or '.')
    return urlunsplit(('', '', newpath, u.query,u.fragment))

def translate_doc(doc, locale, dictionaries):
    if locale=='zh-TW':return
    for node in list(doc.find_all(string=True)):
        if isinstance(node,Comment) or node.parent.name in ['script','style'] or node.parent.find_parent(attrs={'data-no-translate':''}) or node.parent.has_attr('data-no-translate'):continue
        text=str(node); trim=text.strip();tr=translated(trim,locale,dictionaries)
        if tr!=trim:node.replace_with(text.replace(trim,tr))
    for tag in doc.find_all(True):
        if tag.has_attr('data-no-translate') or tag.find_parent(attrs={'data-no-translate':''}):continue
        for a in ['title','alt','placeholder','aria-label']:
            if a in tag.attrs:tag[a]=translated(tag[a],locale,dictionaries)
        if tag.name=='meta' and tag.get('name')=='description':tag['content']=translated(tag['content'],locale,dictionaries)


def run(base_only=False):
    records=catalogue()
    (SITE/'resources.html').write_text(resources_html(records),encoding='utf-8')
    # A small entry inside the original friendly-links section retains the existing homepage layout.
    doc=soup((SITE/'index.html').read_text())
    old=doc.select_one('.resource-home-entry')
    if old:old.decompose()
    section=doc.find('li',attrs={'aria-label':'友善連結'})
    if section:
        entry=fragment('<div class="resource-home-entry"><h2>高雄、台灣與國際巴金森資源</h2><p>依地區與用途整理官方醫療、病友支持、衛教及研究入口，幫助您找到需要的資訊。</p><a href="./resources.html">查看巴金森資源導航</a></div>')
        container=section.select_one('.container');container.append(entry)
    (SITE/'index.html').write_text(str(doc),encoding='utf-8')
    (SITE/'社團法人高雄市聰動成長協會.html').write_text(str(doc),encoding='utf-8')
    htmlpaths={p.relative_to(SITE).as_posix() for p in SITE.rglob('*.html') if p.relative_to(SITE).parts[0] not in LOCALES[1:]}
    base_docs={p:common(soup((SITE/p).read_text()),p) for p in sorted(htmlpaths)}
    medical_page=base_docs.get('blog/activity-1140705.html')
    if medical_page and not medical_page.select_one('.sa-medical-review'):
        note=medical_page.new_tag('p',attrs={'class':'notice sa-medical-review'})
        note.string='本頁為原活動記錄；飲食與用藥時機的部分文字仍需醫療團隊核對，請勿據此自行調整藥物。'
        medical_page.main.h1.insert_after(note)
    units=readjson(ROOT/'來源資料/i18n/source-units.json');extra=readjson(ROOT/'來源資料/i18n/extra-terms.json')
    dictionaries={l:{} for l in LOCALES}
    for u in units:dictionaries['zh-CN'][u['source']]=CC.convert(u['source'])
    for l in ['en','fr','ja','es']:
        file=ROOT/'來源資料/i18n'/f'{l}.json'
        if not file.exists():
            if not base_only:raise RuntimeError('Missing '+str(file))
            continue
        trans=readjson(file)
        missing=[u['id'] for u in units if not trans.get(u['id'])]
        if missing and not base_only:raise RuntimeError(f'{l} missing {len(missing)}: {missing[:5]}')
        for u in units:
            if trans.get(u['id']):dictionaries[l][u['source']]=trans[u['id']]
    for row in extra:
        dictionaries['zh-CN'][row[0]]=CC.convert(row[0])
        for l,v in zip(['en','fr','ja','es'],row[1:]):dictionaries[l][row[0]]=v
    for r in records:
        for k in ['title','description']:
            for l in LOCALES:dictionaries[l][r[k]['zh-TW']]=r[k][l]
    dictionaries['zh-CN']['Drug induced Parkinsonism & Movement Disorders']='药物诱发的帕金森综合征与运动障碍'
    dictionaries['zh-CN']['Others...']='其他…'
    for row in extra:
        try:
            from datetime import datetime
            date=datetime.strptime(row[0],'%B %d, %Y')
            dictionaries['zh-CN'][row[0]]=f'{date.year}年{date.month}月{date.day}日'
        except ValueError:pass
    config={'translations':dictionaries}
    (SITE/ASSETS/'language-data.js').write_text('window.SmartActionI18n='+json.dumps(config,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
    versions={p.relative_to(SITE).as_posix():hashlib.sha256(p.read_bytes()).hexdigest()[:10] for p in (SITE/ASSETS).rglob('*') if p.suffix in ['.css','.js']}
    locales=['zh-TW'] if base_only else LOCALES
    sitemap=[];missing_pages=[]
    for page,docbase in base_docs.items():
        # Make the duplicate filename an alias of index.html for search purposes.
        canonical_page='index.html' if page=='社團法人高雄市聰動成長協會.html' else page
        thin='這篇文章尚待補齊' in docbase.get_text()
        if thin:missing_pages.append(page)
        for locale in locales:
            doc=copy.deepcopy(docbase)
            destination=('' if locale=='zh-TW' else locale+'/')+page
            root=doc.html;root['lang']=locale;root['data-page-locale']=locale;root['data-page-path']=page;root['data-locale-variant']='false' if locale=='zh-TW' else 'true'
            root['data-site-root']=posixpath.relpath('.',posixpath.dirname(destination) or '.')+'/'
            for tag in doc.find_all(True):
                for a in ['href','src','poster','data-video-help','data-bg']:
                    if not isinstance(tag.get(a),str):continue
                    value=tag[a]
                    if a=='href' and tag.name=='a':
                        u=urlsplit(value)
                        if not u.scheme and not u.netloc and u.path:
                            target=posixpath.normpath(posixpath.join(posixpath.dirname(page),unquote(u.path)))
                            if target=='.':target='index.html'
                            elif u.path.endswith('/'):target=target.rstrip('/')+'/index.html'
                            if target in htmlpaths:tag['data-page-target']=target
                    # Language anchors are already explicit; root zh-TW links must remain zh-TW.
                    if tag.find_parent(id='sa-language-links'):
                        u=urlsplit(value);target=posixpath.normpath(posixpath.join(posixpath.dirname(page),unquote(u.path)))
                        tag[a]=urlunsplit(('', '', posixpath.relpath(target,posixpath.dirname(destination) or '.'),u.query,u.fragment))
                        tag.attrs.pop('data-page-target',None)
                    else:tag[a]=relative_url(value,page,destination,locale,htmlpaths)
                if isinstance(tag.get('style'),str):
                    tag['style']=re.sub(r'url\([\"\']?([^\"\')]+)[\"\']?\)',lambda m:'url("'+relative_url(m[1],page,destination,locale,htmlpaths)+'")',tag['style'])
            for style in doc.find_all('style'):
                if style.string:
                    style.string = re.sub(r'url\([\"\']?([^\"\')]+)[\"\']?\)',lambda m:'url(\"'+relative_url(m[1],page,destination,locale,htmlpaths)+'\")',str(style.string))
            for assettag in doc.select('script[src],link[href]'):
                attr = 'src' if assettag.name=='script' else 'href'
                u=urlsplit(assettag[attr])
                if not u.scheme and not u.netloc and u.path.endswith(('.css','.js')):
                    key=posixpath.normpath(posixpath.join(posixpath.dirname(destination),u.path))
                    assettag[attr]=urlunsplit(('', '', u.path, 'v='+versions.get(key,'20261006'),u.fragment))
            translate_doc(doc,locale,dictionaries)
            if locale!='zh-TW':doc.select_one('.sa-locale-note').attrs.pop('hidden',None)
            # Shared meta descriptions are short, honest, and localized.
            for tag in doc.head.select('link[rel=canonical],link[rel=alternate][hreflang],meta[name=description],meta[name=robots],meta[property^="og:"],script[type="application/ld+json"]'):tag.decompose()
            description=translated('聰動成長協會：活動、巴金森衛教與病友支持資源。',locale,dictionaries)
            if page=='resources.html':description=translated('依地區與用途整理官方醫療、病友支持、衛教及研究入口，幫助您找到需要的資訊。',locale,dictionaries)
            doc.head.append(doc.new_tag('meta',attrs={'name':'description','content':description}))
            canonical=BASE+('' if locale=='zh-TW' else locale+'/')+quote(canonical_page,safe='/')
            doc.head.append(doc.new_tag('link',rel='canonical',href=canonical))
            for l in LOCALES:
                url=BASE+('' if l=='zh-TW' else l+'/')+quote(canonical_page,safe='/')
                doc.head.append(doc.new_tag('link',rel='alternate',hreflang=l,href=url))
            doc.head.append(doc.new_tag('link',rel='alternate',hreflang='x-default',href=BASE+quote(canonical_page,safe='/')))
            for property,value in [('og:title',doc.title.get_text()),('og:description',description),('og:url',canonical),('og:type','website'),('og:image',BASE+quote(ASSETS+'/856889_768120.png'))]:
                doc.head.append(doc.new_tag('meta',attrs={'property':property,'content':value}))
            if thin:doc.head.append(doc.new_tag('meta',attrs={'name':'robots','content':'noindex,follow'}))
            schema={'@context':'https://schema.org','@type':'CollectionPage' if page=='resources.html' else 'WebPage','name':doc.title.get_text(),'url':canonical,'inLanguage':locale,'description':description}
            if page=='resources.html':schema['mainEntity']={'@type':'ItemList','numberOfItems':len(records),'itemListElement':[{'@type':'ListItem','position':i+1,'name':r['title'][locale],'url':r['url']} for i,r in enumerate(records)]}
            structured=doc.new_tag('script',type='application/ld+json');structured.string=json.dumps(schema,ensure_ascii=False);doc.head.append(structured)
            path=SITE/destination;path.parent.mkdir(parents=True,exist_ok=True);path.write_text(str(doc),encoding='utf-8')
            if not thin and page!='社團法人高雄市聰動成長協會.html':sitemap.append(canonical)
    (SITE/'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+''.join('<url><loc>'+html.escape(u)+'</loc></url>\n' for u in sitemap)+'</urlset>\n',encoding='utf-8')
    data=SITE/'維護工具';data.mkdir(exist_ok=True)
    (data/'resources.json').write_text(json.dumps(records,ensure_ascii=False,indent=2),encoding='utf-8')
    (data/'translations.json').write_text(json.dumps(config,ensure_ascii=False,indent=2),encoding='utf-8')
    with (SITE/'巴金森資源清單.csv').open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.writer(f);w.writerow(['地區','用途','名稱','網址','來源語言','查核日期','查核方式'])
        for r in records:w.writerow([REGIONS[r['region']],KINDS[r['kind']],r['title']['zh-TW'],r['url'],','.join(r['languages']),r['checkedDate'],r['verification']])
    summary={'basePages':len(htmlpaths),'locales':locales,'htmlPages':len(htmlpaths)*len(locales),'resources':len(records),'sitemapURLs':len(sitemap),'missingContentPages':missing_pages,'translationCounts':{l:len(dictionaries[l]) for l in LOCALES}}
    (ROOT/'來源資料/upgrade-build.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
    print(json.dumps(summary,ensure_ascii=False))

if __name__=='__main__':
    import sys
    run('--base-only' in sys.argv)
