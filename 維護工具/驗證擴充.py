#!/usr/bin/env python3
"""Static checks only; not a replacement for real device/browser QA."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import json,xml.etree.ElementTree as ET
ROOT=Path(__file__).resolve().parents[1]
class Parser(HTMLParser):
    def __init__(self):super().__init__();self.links=[]
    def handle_starttag(self,tag,attrs):
        attrs=dict(attrs)
        for name in ('href','src'):
            if tag in ('a','script','link','img','iframe') and attrs.get(name):self.links.append(attrs[name])
        if tag=='script' and attrs.get('type')=='application/ld+json':self.in_json=True
    def handle_data(self,data):
        if getattr(self,'in_json',False):json.loads(data)
    def handle_endtag(self,tag):
        if tag=='script':self.in_json=False
missing=[]
pages=[p for p in ROOT.rglob('*.html') if '.venv' not in p.parts and 'runtime' not in p.parts]
for path in pages:
    parser=Parser();parser.feed(path.read_text(encoding='utf-8'))
    for value in parser.links:
        url=urlsplit(value)
        if url.scheme or url.netloc or not url.path:continue
        target=(path.parent/unquote(url.path)).resolve()
        if target.is_dir():target=target/'index.html'
        if not target.exists():missing.append((str(path.relative_to(ROOT)),value))
locales=json.loads((ROOT/'assets/portal-locales.json').read_text())['locales']
codes=[x['code'] for x in locales]
assert len(codes)==len(set(codes))==78
assert all({'homepageTitle','intro','translationNotice','start','drone','video'}.issubset(l['strings']) for l in locales)
for l in locales:assert (ROOT/'l'/l['code']/'index.html').exists()
urls=[x.text for x in ET.parse(ROOT/'sitemap.xml').findall('.//{*}loc')]
assert len(urls)==len(set(urls)), 'Duplicate sitemap URLs'
assert len(list((ROOT/'blog').glob('*.html')))==49
if missing:
    print('Missing references:',missing)
    raise SystemExit(1)
print(json.dumps({'html_pages':len(pages),'local_broken_references':0,'locale_overviews':78,'sitemap_urls':len(urls),'legacy_articles':48,'browser_visual_test':'not executed; requires a real target browser'},ensure_ascii=False,indent=2))
