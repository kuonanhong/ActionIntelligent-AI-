/* Optional market bridge. Provider secrets stay in Worker secret bindings. */
const json=(value,status=200,extra={})=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json;charset=utf-8',...extra}});
const num=v=>v===null||v===undefined||v===''?null:(Number.isFinite(Number(String(v).replace(/,/g,'')))?Number(String(v).replace(/,/g,'')):null);
const nonempty=v=>typeof v==='string'&&v.trim();
function allowedRequest(url,env){
 const kind=url.pathname.replace(/^\//,'');const provider=url.searchParams.get('provider')||'twse',symbol=(url.searchParams.get('symbol')||'').toUpperCase();
 if(!['quote','history'].includes(kind))return {error:'Not found',status:404};
 if(!['twse','alpha','finnhub'].includes(provider)||!/^[A-Z0-9.^_-]{1,24}$/.test(symbol))return {error:'Invalid provider or symbol',status:400};
 if(kind==='history'&&provider!=='alpha')return {error:'History is available through Alpha Vantage only; CSV import is also supported.',status:400};
 if(provider==='twse'&&!/^\d{4,6}[A-Z]?$/.test(symbol))return {error:'Invalid TWSE symbol',status:400};
 if(provider!=='twse'&&!(env.ALLOWED_SYMBOLS||'IBM,AAPL,MSFT,NVDA,TSM').split(',').map(s=>s.trim()).includes(symbol))return {error:'Symbol is not in the operator’s approved list.',status:403};
 return {kind,provider,symbol};
}
export default {
 async fetch(request,env,ctx){
  const origin=request.headers.get('Origin')||'';const allowed=(env.ALLOWED_ORIGINS||'https://kuonanhong.github.io').split(',').map(s=>s.trim());
  if(origin&&!allowed.includes(origin))return json({error:'Origin is not allowed'},403);
  const cors={'Access-Control-Allow-Origin':origin||allowed[0],'Vary':'Origin','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Content-Type','X-Content-Type-Options':'nosniff'};
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  if(request.method!=='GET')return json({error:'GET only'},405,cors);
  const url=new URL(request.url);
  if(url.pathname==='/health')return json({status:'ok',providers:{twse:true,alpha:!!env.ALPHA_VANTAGE_API_KEY,finnhub:!!env.FINNHUB_API_KEY},note:'No real-time entitlement is implied.'},200,cors);
  const q=allowedRequest(url,env);if(q.error)return json({error:q.error},q.status,cors);
  if(env.RATE_LIMITER){const limit=await env.RATE_LIMITER.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'});if(!limit.success)return json({error:'Request limit reached; please wait.'},429,{...cors,'Retry-After':'60'});}
  const key=new URL(request.url);key.search='';key.searchParams.set('provider',q.provider);key.searchParams.set('symbol',q.symbol);
  const cache=caches.default,cacheRequest=new Request(key.toString());let cached=await cache.match(cacheRequest);
  if(cached){const headers=new Headers(cached.headers);Object.entries(cors).forEach(([k,v])=>headers.set(k,v));headers.set('X-SmartAction-Cache','edge');return new Response(cached.body,{status:cached.status,headers});}
  try{
   const obj=env.MARKET_HUB.get(env.MARKET_HUB.idFromName('shared-market-quota-v1'));
   const result=await obj.fetch(new Request('https://internal/'+q.kind+'?provider='+q.provider+'&symbol='+encodeURIComponent(q.symbol)));
   const body=await result.text();const ttl=q.provider==='twse'||q.kind==='history'?300:30;
   const response=new Response(body,{status:result.status,headers:{...cors,'content-type':'application/json;charset=utf-8','Cache-Control':result.ok?'public, max-age='+ttl:'no-store'}});
   if(result.ok)ctx.waitUntil(cache.put(cacheRequest,response.clone()));return response;
  }catch{return json({error:'Market bridge temporarily unavailable.'},503,cors);}
 }
};
export class MarketHub {
 constructor(ctx,env){this.ctx=ctx;this.env=env;this.tail=Promise.resolve();}
 fetch(request){const task=this.tail.then(()=>this.handle(request));this.tail=task.catch(()=>{});return task;}
 async reserve(provider){
  const now=new Date(),day=now.toISOString().slice(0,10),minute=Math.floor(now.getTime()/60000);const k='budget:'+provider;
  let b=await this.ctx.storage.get(k)||{};if(b.day!==day)b={day,count:0,minute,minuteCount:0};if(b.minute!==minute){b.minute=minute;b.minuteCount=0;}
  const defaults={twse:[200,2],alpha:[25,5],finnhub:[2000,30]};const prefix=provider.toUpperCase();const daily=Number(this.env[prefix+'_DAILY_LIMIT']||defaults[provider][0]),perMinute=Number(this.env[prefix+'_MINUTE_LIMIT']||defaults[provider][1]);
  if(b.count>=daily||b.minuteCount>=perMinute)throw {publicMessage:'Operator upstream request budget reached. Please retry later.',status:429};
  b.count++;b.minuteCount++;await this.ctx.storage.put(k,b);
 }
 async upstream(provider,url,headers={}){
  await this.reserve(provider);let r;try{r=await fetch(url,{headers,signal:AbortSignal.timeout(12000)});}catch{throw {publicMessage:'Data provider connection failed or timed out.',status:502};}
  if(!r.ok)throw {publicMessage:'Data provider rejected the request (HTTP '+r.status+').',status:502};
  try{return await r.json();}catch{throw {publicMessage:'Data provider returned an unexpected format.',status:502};}
 }
 async handle(request){
  const q=allowedRequest(new URL(request.url),this.env);if(q.error)return json({error:q.error},q.status);const {kind,provider,symbol}=q;
  const storageKey=provider==='twse'?'data:twse:all':'data:'+provider+':'+kind+':'+symbol;
  let entry=await this.ctx.storage.get(storageKey);const ttl=provider==='twse'?3600000:kind==='history'?21600000:provider==='alpha'&&(this.env.ALPHA_ENTITLEMENT||'none')==='none'?21600000:60000;
  try{
   if(!entry||Date.now()-entry.savedAt>=ttl){let payload;
    if(provider==='twse'){
     payload=await this.upstream('twse','https://openapi.twse.com.tw/v1/exchangeReport/STOCK_DAY_ALL');if(!Array.isArray(payload))throw {publicMessage:'TWSE data format changed.',status:502};
    }else if(provider==='alpha'){
     if(!nonempty(this.env.ALPHA_VANTAGE_API_KEY))throw {publicMessage:'Alpha Vantage API key is not configured on the server.',status:503};
     const u=new URL('https://www.alphavantage.co/query');u.searchParams.set('function',kind==='history'?'TIME_SERIES_DAILY':'GLOBAL_QUOTE');u.searchParams.set('symbol',symbol);u.searchParams.set('apikey',this.env.ALPHA_VANTAGE_API_KEY);if(kind==='history')u.searchParams.set('outputsize','compact');
     if(kind==='quote'&&['realtime','delayed'].includes(this.env.ALPHA_ENTITLEMENT))u.searchParams.set('entitlement',this.env.ALPHA_ENTITLEMENT);
     payload=await this.upstream('alpha',u.toString());if(payload.Note||payload.Information||payload['Error Message'])throw {publicMessage:'Alpha Vantage returned a quota, entitlement or symbol error. Check the server account.',status:502};
    }else{
     if(!nonempty(this.env.FINNHUB_API_KEY))throw {publicMessage:'Finnhub API key is not configured on the server.',status:503};
     const u=new URL('https://finnhub.io/api/v1/quote');u.searchParams.set('symbol',symbol);payload=await this.upstream('finnhub',u.toString(),{'X-Finnhub-Token':this.env.FINNHUB_API_KEY});if(payload.error)throw {publicMessage:'Finnhub returned an entitlement or symbol error.',status:502};
    }
    entry={savedAt:Date.now(),payload};
    // The TWSE all-symbol JSON exceeds one DO storage value on some days: keep
    // individual values under 128 KiB while retaining a shared data generation.
    if(provider==='twse'){
     const list=payload;const chunks=[];for(let i=0;i<list.length;i+=120)chunks.push(list.slice(i,i+120));
     const generation=String(entry.savedAt);for(let i=0;i<chunks.length;i++)await this.ctx.storage.put('twse:'+generation+':'+i,chunks[i]);
     const old=await this.ctx.storage.get(storageKey);await this.ctx.storage.put(storageKey,{savedAt:entry.savedAt,generation,chunks:chunks.length});
     if(old?.generation&&old.generation!==generation){for(let i=0;i<old.chunks;i++)await this.ctx.storage.delete('twse:'+old.generation+':'+i);}
    }else await this.ctx.storage.put(storageKey,entry);
   }
   if(provider==='twse'&&!entry.payload){const arrays=[];for(let i=0;i<entry.chunks;i++)arrays.push(...(await this.ctx.storage.get('twse:'+entry.generation+':'+i)||[]));entry={...entry,payload:arrays};}
   const fetchedAt=new Date(entry.savedAt).toISOString(),cacheSeconds=Math.ceil(ttl/1000)+300;
   const currencyMap=(()=>{try{return JSON.parse(this.env.SYMBOL_CURRENCIES||'{}');}catch{return {};}})();
   if(provider==='twse'){
    const p=entry.payload.find(x=>x.Code===symbol);if(!p)return json({error:'No TWSE record for this symbol.'},404);const d=String(p.Date||'');const asOf=/^\d{7}$/.test(d)?`${Number(d.slice(0,3))+1911}-${d.slice(3,5)}-${d.slice(5,7)} (Asia/Taipei)`:(d||'unknown');
    return json({symbol,name:p.Name,price:num(p.ClosingPrice),open:num(p.OpeningPrice),high:num(p.HighestPrice),low:num(p.LowestPrice),volume:num(p.TradeVolume),currency:'TWD',source:'TWSE OpenAPI / STOCK_DAY_ALL',asOf,fetchedAt,freshness:'eod',cacheSeconds});
   }
   if(provider==='alpha'&&kind==='history'){
    const series=entry.payload['Time Series (Daily)'];if(!series)return json({error:'No daily history returned.'},404);const points=Object.entries(series).map(([date,v])=>({date,close:num(v['4. close'])})).filter(x=>x.close>0).sort((a,b)=>a.date.localeCompare(b.date));
    return json({symbol,points,adjusted:false,source:'Alpha Vantage TIME_SERIES_DAILY (unadjusted)',fetchedAt,freshness:'eod',cacheSeconds});
   }
   if(provider==='alpha'){
    const p=entry.payload['Global Quote'];if(!p||!(num(p['05. price'])>0))return json({error:'No quote returned for this symbol.'},404);
    return json({symbol,price:num(p['05. price']),open:num(p['02. open']),high:num(p['03. high']),low:num(p['04. low']),volume:num(p['06. volume']),currency:currencyMap[symbol]||'',source:'Alpha Vantage GLOBAL_QUOTE',asOf:(p['07. latest trading day']||'unknown')+' (provider exposes date only)',fetchedAt,freshness:['realtime','delayed'].includes(this.env.ALPHA_ENTITLEMENT)?this.env.ALPHA_ENTITLEMENT:'eod',cacheSeconds});
   }
   const p=entry.payload;if(!(num(p.c)>0)||!(num(p.t)>0))return json({error:'No valid Finnhub quote returned.'},404);
   return json({symbol,price:num(p.c),open:num(p.o),high:num(p.h),low:num(p.l),currency:currencyMap[symbol]||'',source:'Finnhub quote',asOf:new Date(p.t*1000).toISOString(),fetchedAt,freshness:'unknown',cacheSeconds});
  }catch(e){return json({error:e.publicMessage||'Provider response could not be processed.'},e.status||502);}
 }
}
