/* Run: node tests/portal-static.cjs [--partial]. No npm dependencies. */
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'..'),partial=process.argv.includes('--partial');
const results=[],failures=[];let checkedLinks=0;
const record=(name,ok,detail='')=>{results.push({name,ok,detail});if(!ok)failures.push({name,detail});};
const walk=dir=>fs.existsSync(dir)?fs.readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()&&!['vendor','models','tests'].includes(d.name)?walk(path.join(dir,d.name)):d.isFile()?[path.join(dir,d.name)]:[]):[];
const dirs=['tools','market','assistant','quiz','knowledge','learn','play','shop'];
const files=[...new Set([...['index.html','knowledge.html','quiz.html','learn.html','world.html','play.html','resources.html','videos.html','privacy.html','editorial.html','deployment.html','question-bank.html','en/question-bank.html',...['zh-CN','en','ja','ko','ar','ms','th','vi','id','fil','de','pl','cs','pt','fi','sv','ru','fr','es','it','hi'].map(l=>l+'/index.html')].map(n=>path.join(root,n)),...dirs.flatMap(d=>walk(path.join(root,d))),...walk(path.join(root,'assets')).filter(f=>/hub|20261009/.test(path.basename(f)))])].filter(f=>fs.existsSync(f)&&/\.(html|css)$/.test(f));
function localTarget(raw,base){
 raw=raw.replace(/&amp;/g,'&').replace(/&#(?:x([\da-f]+)|(\d+));/gi,(_,a,b)=>String.fromCodePoint(parseInt(a||b,a?16:10)));
 if(!raw||/^(?:data:|blob:|https?:|mailto:|tel:|javascript:|\/\/)/i.test(raw))return null;
 try{const u=new URL(raw,'https://qa.invalid/SmartAction/'+path.relative(root,base).replaceAll(path.sep,'/'));if(!u.pathname.startsWith('/SmartAction/'))return {outside:true,raw};let f=path.resolve(root,decodeURIComponent(u.pathname.slice('/SmartAction/'.length)));if(fs.existsSync(f)&&fs.statSync(f).isDirectory())f=path.join(f,'index.html');return {file:f,hash:decodeURIComponent(u.hash.slice(1)),raw};}catch{return {invalid:true,raw};}
}
for(const f of files){
 const s=fs.readFileSync(f,'utf8');const refs=[];
 if(f.endsWith('.html'))for(const m of s.matchAll(/\b(?:href|src|poster)\s*=\s*(["'])(.*?)\1/gi))refs.push(m[2]);
 else for(const m of s.matchAll(/url\(\s*["']?([^)'"\s]+)["']?\s*\)/gi))refs.push(m[1]);
 for(const raw of refs){const t=localTarget(raw,f);if(!t)continue;checkedLinks++;record('relative:'+path.relative(root,f)+' → '+raw,!t.invalid&&!t.outside&&fs.existsSync(t.file),t.invalid?'invalid URL':t.outside?'escapes project prefix':fs.existsSync(t.file)?'':path.relative(root,t.file));}
}
record('article inventory preserved',fs.existsSync(path.join(root,'assets/video-audit.json')));
if(fs.existsSync(path.join(root,'assets/video-audit.json'))){const v=JSON.parse(fs.readFileSync(path.join(root,'assets/video-audit.json'),'utf8'));record('48 baseline article paths exist',v.articles.length===48&&v.articles.every(a=>fs.existsSync(path.join(root,a.path))));record('14 unique inventoried videos',new Set(v.videos.map(a=>a.id)).size===14);record('unverified video timestamps remain unset',v.videos.every(a=>a.verifiedStartSeconds===null&&a.verifiedTimestamps.length===0));}
for(const lang of ['','zh-CN','en','ja','fr','es']){const q=path.join(root,lang,'blog','33cb605cf06.html');if(!fs.existsSync(q))continue;const s=fs.readFileSync(q,'utf8');record('one lecture player:'+lang,(s.match(/data-youtube-id="wOPCyV281rU"/g)||[]).length===1);const n=fs.readFileSync(path.join(root,lang,'blog','activity-1140705.html'),'utf8');record('individual nutrition note:'+lang,n.includes('id="sa-protein-medication"')&&!/0\.8\s*(?:克|gram|g[. ]|g。)/.test(n));}
const questionFile=path.join(root,'assets/knowledge-questions.js'),sourceFile=path.join(root,'assets/knowledge-sources.js');
if(fs.existsSync(questionFile)&&fs.existsSync(sourceFile)){
 const c={window:{}};for(const f of [questionFile,sourceFile])vm.runInNewContext(fs.readFileSync(f,'utf8'),c,{timeout:2000});const qs=c.window.SA_QUESTIONS,ss=c.window.SA_SOURCES;
 record('exactly 100 unique question IDs',qs.length===100&&new Set(qs.map(q=>q.id)).size===100&&qs.every((q,i)=>q.id==='Q'+String(i+1).padStart(3,'0')));
 record('80 multiple choice and 20 fill questions',qs.filter(q=>q.type==='choice').length===80&&qs.filter(q=>q.type==='fill').length===20);
 for(const q of qs){record('question bilingual shape:'+q.id,['zh-Hant','en'].every(l=>q.question[l]&&q.explanation[l]&&q.hint[l]&&(q.type==='choice'?[4,5].includes(q.options[l].length)&&Number.isInteger(q.answer)&&q.answer>=0&&q.answer<q.options[l].length:Array.isArray(q.accepted[l])&&q.accepted[l].some(a=>typeof a==='string'&&a.trim()))));record('question source locator:'+q.id,q.sources.length>0&&q.sources.every(s=>ss[s.sourceId]&&s.section&&s.locator&&s.timestamp===null));}
 for(const [id,s] of Object.entries(ss)){const t=localTarget(s.url,path.join(root,'index.html'));if(t){const exists=!t.invalid&&!t.outside&&fs.existsSync(t.file);record('local quiz source exists:'+id,exists);if(exists&&t.hash)record('local quiz source anchor:'+id,new RegExp('\\bid=[\"\']'+t.hash.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')+'[\"\']').test(fs.readFileSync(t.file,'utf8')));}else record('external quiz source HTTPS:'+id,s.url.startsWith('https://'));}
}
const localeFile=path.join(root,'assets/hub-locales.js');if(fs.existsSync(localeFile)){const c={window:{}};vm.runInNewContext(fs.readFileSync(localeFile,'utf8'),c,{timeout:2000});const d=c.window.SA_HUB_I18N;record('22 unique portal languages',d.languages.length===22&&new Set(d.languages.map(x=>x.code)).size===22);const keys=Object.keys(d.messages.en);record('all portal language messages present',d.languages.every(l=>keys.every(k=>typeof d.messages[l.code]?.[k]==='string'&&d.messages[l.code][k].trim())));record('Arabic RTL metadata',d.languages.find(l=>l.code==='ar')?.dir==='rtl');}
const report={kind:'static-integration',date:new Date().toISOString(),partial,files:files.length,checkedLinks,passed:results.length-failures.length,total:results.length,failures,results};
fs.mkdirSync(path.join(__dirname,'artifacts'),{recursive:true});fs.writeFileSync(path.join(__dirname,'artifacts','portal-static-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({files:files.length,checkedLinks,passed:report.passed,total:report.total,failures},null,2));
process.exitCode=failures.length?1:0;
