/* Pure local calculations: descriptive statistics, never a prediction. */
(function(root){
'use strict';
function parseCSV(text){
 const rows=[]; let row=[], cell='', quote=false;
 text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){cell+='"';i++;}else quote=!quote;}else if(c===','&&!quote){row.push(cell);cell='';}else if((c==='\n'||c==='\r')&&!quote){if(c==='\r'&&text[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x.trim()))rows.push(row);row=[];cell='';}else cell+=c;}
 if(quote)throw Error('CSV quotation is not closed.');row.push(cell);if(row.some(x=>x.trim()))rows.push(row);
 if(rows.length<2)throw Error('CSV needs a header and at least one observation.');
 const h=rows.shift().map(x=>x.trim().toLowerCase().replace(/[\s-]+/g,'_'));
 const di=h.findIndex(x=>['date','timestamp','日期'].includes(x));
 let pi=h.findIndex(x=>['adjusted_close','adj_close','調整收盤價'].includes(x));const adjusted=pi>=0;
 if(pi<0)pi=h.findIndex(x=>['close','closingprice','收盤價'].includes(x));
 if(di<0||pi<0)throw Error('Required headers: date,close (or date,adjusted_close).');
 if(rows.length>10000)throw Error('Maximum 10,000 observations.');
 const seen=new Set();const points=rows.map((r,i)=>{const date=String(r[di]||'').trim().replace(/\//g,'-');const p=Number(String(r[pi]||'').replace(/,/g,''));if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date)throw Error('Invalid ISO date on row '+(i+2));if(!Number.isFinite(p)||p<=0)throw Error('Price must be positive on row '+(i+2));if(seen.has(date))throw Error('Duplicate date: '+date);seen.add(date);return {date,close:p};}).sort((a,b)=>a.date.localeCompare(b.date));
 return {points,adjusted};
}
function statistics(points,sessions=252){
 if(!Array.isArray(points)||points.length<2)throw Error('At least 2 observations are required.');
 if(!Number.isFinite(sessions)||sessions<1||sessions>366)throw Error('Sessions per year must be 1–366.');
 const p=points.map(x=>x.close);if(p.some(x=>!Number.isFinite(x)||x<=0))throw Error('Invalid prices.');
 const ret=p.slice(1).map((v,i)=>Math.log(v/p[i]));const avg=ret.reduce((a,b)=>a+b,0)/ret.length;
 const variance=ret.length>1?ret.reduce((s,r)=>s+(r-avg)**2,0)/(ret.length-1):null;
 let peak=p[0],drawdown=0;for(const v of p){peak=Math.max(peak,v);drawdown=Math.min(drawdown,v/peak-1);}
 const sma=n=>p.length>=n?p.slice(-n).reduce((a,b)=>a+b,0)/n:null;
 return {observations:p.length,from:points[0].date,to:points.at(-1).date,last:p.at(-1),totalReturn:p.at(-1)/p[0]-1,sma20:sma(20),sma60:sma(60),annualVolatility:variance===null?null:Math.sqrt(variance*sessions),maxDrawdown:drawdown,sessions};
}
const api={parseCSV,statistics};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MarketAnalysis=api;
})(typeof globalThis!=='undefined'?globalThis:this);
