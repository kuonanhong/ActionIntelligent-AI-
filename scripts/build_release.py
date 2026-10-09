#!/usr/bin/env python3
"""Package the static site with integrity metadata; no build service required."""
from pathlib import Path
import hashlib,json,zipfile,shutil,re
P=Path(__file__).resolve().parents[1]
OUT=P.parent/'deliverables';OUT.mkdir(exist_ok=True)
manifest=[]
for f in sorted(P.rglob('*')):
 if not f.is_file() or f.name=='PACKAGE_MANIFEST.json' or '__pycache__' in f.parts:continue
 manifest.append({'path':f.relative_to(P).as_posix(),'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
(P/'PACKAGE_MANIFEST.json').write_text(json.dumps({'release':'2026-10-09','files':manifest},ensure_ascii=False,indent=2))
archive=OUT/'SmartAction_20261009_完整網站套件.zip'
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
 for f in sorted(P.rglob('*')):
  if f.is_file() and '__pycache__' not in f.parts:z.write(f,'SmartAction/'+f.relative_to(P).as_posix())
with zipfile.ZipFile(archive) as z:
 bad=z.testzip()
 if bad:raise RuntimeError('ZIP verification failed: '+bad)
 if max(x.file_size for x in z.infolist())>=100*1024*1024:raise RuntimeError('A file exceeds GitHub 100 MiB limit')
# Standalone, styled deployment guide. Relative documentation paths assume the
# adjacent extracted SmartAction folder; the guide itself has no dependency.
guide=(P/'deployment.html').read_text()
guide=re.sub(r'<link[^>]*href=["\']assets/hub.css["\'][^>]*>',lambda _: '<style>'+(P/'assets/hub.css').read_text()+'</style>',guide)
guide=re.sub(r'href="(?!https?:|#|mailto:|data:)([^\"]+)"',lambda m:'href="SmartAction/'+m.group(1)+'"',guide)
(OUT/'SmartAction_部署操作教學.html').write_text(guide)
shutil.copy2(P/'docs/QUIZ_SOURCE_MAP.csv',OUT/'SmartAction_100題答案與來源.csv')
shutil.copy2(P/'tests/artifacts/portal-desktop.png',OUT/'SmartAction_首頁預覽.png')
summary={'files':len(manifest)+1,'site_bytes':sum(x['bytes'] for x in manifest)+(P/'PACKAGE_MANIFEST.json').stat().st_size,'archive_bytes':archive.stat().st_size,'archive_sha256':hashlib.sha256(archive.read_bytes()).hexdigest(),'largest_file':max(manifest,key=lambda x:x['bytes'])}
(OUT/'release-summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
print(json.dumps(summary,ensure_ascii=False,indent=2))
