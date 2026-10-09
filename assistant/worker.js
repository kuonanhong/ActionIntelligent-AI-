/* CPU-only local inference. No remote model or inference requests. */
let generator=null;
const base=new URL('./',import.meta.url);
const rawFetch=globalThis.fetch.bind(globalThis);
const cacheName='smartaction-assistant-model-v2';
const post=(type,data={})=>self.postMessage({type,...data});
async function cachedFetch(input,init){
 const url=typeof input==='string'?new URL(input,base).href:input instanceof URL?input.href:input.url;
 if(new URL(url).origin!==base.origin)throw new Error('External requests are disabled.');
 let cache;try{cache=await caches.open(cacheName);const hit=await cache.match(url);if(hit)return hit;}catch{}
 const response=await rawFetch(input,init);
 if(response.ok&&cache){try{await cache.put(url,response.clone());}catch{post('notice',{text:'Browser cache quota is limited. Keep the local server available.'});}}
 return response;
}
globalThis.fetch=cachedFetch;
async function initialize(){
 if(generator)return;
 const {pipeline,env}=await import('./vendor/transformers.min.js');
 env.allowLocalModels=true;env.allowRemoteModels=false;env.localModelPath=new URL('models/',base).href;
 env.useBrowserCache=false;env.useFSCache=false;
 env.backends.onnx.wasm.numThreads=1;env.backends.onnx.wasm.proxy=false;
 env.backends.onnx.wasm.wasmPaths=new URL('vendor/',base).href;
 generator=await pipeline('text2text-generation','flan-t5-small',{device:'wasm',dtype:'q8',local_files_only:true,
  progress_callback:p=>{if(p.status==='progress')post('progress',{text:p.file,progress:Math.round(p.progress||0)});}});
 post('ready');
}
self.onmessage=async({data})=>{
 try{
  if(data.type==='init'){await initialize();return;}
  if(data.type==='generate'){
   await initialize();
   const {TextStreamer}=await import('./vendor/transformers.min.js');
   const streamer=new TextStreamer(generator.tokenizer,{skip_prompt:false,skip_special_tokens:true,callback_function:token=>post('token',{token})});
   const facts=String(data.context||'').slice(0,1800);
   const prompt=`Answer the question using this context.\nContext: ${facts}\nQuestion: ${String(data.prompt).slice(0,400)}\nAnswer:`;
   const start=performance.now();
   const out=await generator(prompt,{max_new_tokens:80,do_sample:false,repetition_penalty:1.08,streamer});
   const text=out[0].generated_text;
   post('done',{text,seconds:(performance.now()-start)/1000});
  }
  if(data.type==='dispose'){if(generator)await generator.dispose();generator=null;post('disposed');}
 }catch(error){post('error',{message:error.message||String(error)});}
};
