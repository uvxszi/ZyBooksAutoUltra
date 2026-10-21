import { requestCompletion } from './api-stream.js';
import { CATALOG } from './catalog.js';
import { getPrivate, setPrivate } from './model-store.js';
const $=id=>document.getElementById(id), contract=ZBUltraAIContract;
let idleMinutes=5,idleSince=0,resident=false,lastProgress=0;
let cards=[], selected='', installed={}, editing=null, busy=false, worker, activeJob=null, aborter=null, port, rpcId=0;
const pending=new Map();
function makeWorker(){
  worker=new Worker(chrome.runtime.getURL('runtime/worker.js'),{type:'module'});
  worker.onmessage=({data:r})=>{const p=pending.get(r.id);if(!p)return;if(r.progress){progress(r.progress);sendProgress({phase:r.progress.text||'Loading model…'});return;}if(r.update){resident=true;sendProgress(r.update);return;}pending.delete(r.id);r.error?p.reject(Error(r.error)):p.resolve(r.result);};
  worker.onerror=e=>{for(const p of pending.values())p.reject(Error(e.message||'The model worker stopped.'));pending.clear();};
}
function rpc(action,data={}){if(!worker)makeWorker();return new Promise((resolve,reject)=>{const id=++rpcId;pending.set(id,{resolve,reject});worker.postMessage({id,action,...data});});}
function terminate(){worker?.terminate();worker=null;resident=false;memoryStatus();for(const p of pending.values())p.reject(Error('Canceled.'));pending.clear();}
function notice(message){$('status').textContent=message;}
function progress(p){$('progress').value=Math.min(1,Math.max(0,p.progress||0));$('progress-label').textContent=p.text||'Loading model…';}
function setBusy(value,label=''){
  busy=value;$('activity').hidden=!value;$('job-label').textContent=label;$('add').disabled=value;idleSince=value?0:Date.now();
  if(value){$('progress').value=0;$('progress-label').textContent='Preparing…';}render();
}
const meta=id=>CATALOG.find(m=>m.model_id===id);
const gb=n=>(n/1e9).toFixed(2)+' GB';
async function persist(){await setPrivate('cards',cards);await setPrivate('selected',selected);await setPrivate('installed',installed);await chrome.storage.local.set({modelSummary:cards.find(c=>c.id===selected)?{name:cards.find(c=>c.id===selected).name,type:cards.find(c=>c.id===selected).type}:null});}
function button(label,fn,primary=false){const b=document.createElement('button');b.textContent=label;b.disabled=busy;if(primary)b.className='primary';b.onclick=()=>Promise.resolve().then(fn).catch(e=>notice(cleanError(e)));return b;}
function cleanError(error){let text=error.message||String(error);for(const c of cards)if(c.key)text=text.replaceAll(c.key,'[credential]');return text.slice(0,1200);}
function render(){
  const nodes=cards.map(c=>{
    const card=document.createElement('article');card.className='card'+(c.id===selected?' selected':'');
    const tag=document.createElement('span');tag.className='tag';tag.textContent=(c.type==='local'?'LOCAL BROWSER MODEL':'API MODEL')+(c.id===selected?' · SELECTED':'');
    const title=document.createElement('h3');title.textContent=c.name;
    const details=document.createElement('p');details.className='details';const m=meta(c.model);
    details.textContent=c.type==='local'?`${m.label} · ${gb(m.downloadBytes)} weights · about ${(m.vram_required_MB/1000).toFixed(1)} GB GPU baseline\n${c.context.toLocaleString()} context tokens · ${installed[c.model]?'Installed':'Not installed'}`:`${c.apiModel} · ${new URL(c.endpoint).host}`;
    const buttons=document.createElement('div');buttons.className='buttons';
    if(c.id!==selected)buttons.append(button('Select',async()=>{selected=c.id;await persist();render();},true));
    if(c.type==='local'){
      if(installed[c.model])buttons.append(button('Remove download',()=>removeDownload(c)));
      else buttons.append(button('Install Model to Browser',()=>install(c),true));
    }
    buttons.append(button('Edit',()=>edit(c)),button('Delete card',()=>deleteCard(c)));
    card.append(tag,title,details,buttons);return card;
  });
  if(!nodes.length){const p=document.createElement('p');p.textContent='No models yet. Add a local model or connect an API to begin.';nodes.push(p);}
  $('cards').replaceChildren(...nodes);renderCatalog();
}
async function removeDownload(c){setBusy(true,'Removing model download');try{await rpc('delete',{model:c.model});delete installed[c.model];await persist();notice('Download removed. The model card is still available.');}finally{setBusy(false);}}
async function deleteCard(c){
  if(!confirm(`Delete “${c.name}”${c.type==='local'?' and its download if no other card uses it':''}?`))return;
  if(c.type==='local'&&!cards.some(x=>x.id!==c.id&&x.type==='local'&&x.model===c.model))await removeDownload(c);
  cards=cards.filter(x=>x.id!==c.id);if(selected===c.id)selected=cards[0]?.id||'';await persist();render();notice('Model card deleted.');
}
async function install(c){
  const adapter=await navigator.gpu?.requestAdapter();
  if(!adapter)throw Error('WebGPU is unavailable. Update your browser and enable hardware acceleration, or select an API model.');
  const missing=(meta(c.model).required_features||[]).filter(f=>!adapter.features.has(f));
  if(missing.length)throw Error('Your browser GPU lacks '+missing.join(', ')+'. Choose an API model or update your browser and GPU driver.');
  if((await chrome.storage.local.get('options')).options?.enabled===false)throw Error('Turn on the extension before installing a model.');
  setBusy(true,`Installing ${meta(c.model).label} · ${gb(meta(c.model).downloadBytes)}`);
  try{await rpc('install',{model:c.model,context:c.context});installed[c.model]=true;await persist();await rpc('unload');terminate();notice('Installed. Select this card to use it in the question workspace.');}
  catch(e){delete installed[c.model];await persist();throw e;}
  finally{setBusy(false);}
}
function tokenFields(){const enabled=$('limit-output').checked;$('token-limit-field').hidden=!enabled;$('tokens').disabled=!enabled;$('tokens').required=enabled;}
$('limit-output').onchange=tokenFields;
function fields(){const local=$('type').value==='local';$('local-fields').hidden=!local;$('api-fields').hidden=local;$('endpoint').required=!local;$('api-model').required=!local;const m=meta($('model').value);$('model-details').textContent=`${gb(m.downloadBytes)} weights · GPU baseline ${(m.vram_required_MB/1000).toFixed(1)} GB. Downloads start only after you click Install.`;}
function edit(c=null,modelId=null){
  editing=c?.id||null;$('form-title').textContent=c?'Edit model':'Add a model';$('save-model').textContent=c?'Save Model Card':'Create Model Card';
  $('type').value=c?.type||'local';$('name').value=c?.name||(modelId?meta(modelId).label:'');$('model').value=c?.model||modelId||CATALOG[1].model_id;
  $('context').value=c?.context||4096;$('limit-output').checked=c?.limitOutput===true;$('tokens').value=c?.maxTokens||1024;tokenFields();$('temperature').value=c?.temperature??.2;
  $('endpoint').value=c?.endpoint||'';$('api-key').value=c?.key||'';$('api-model').value=c?.apiModel||'';$('format').value=c?.format||'json_schema';$('form-error').textContent='';fields();$('editor').showModal();
}
function endpoint(value){
  const u=new URL(value);if(u.username||u.password||u.hash||u.search)throw Error('Use a URL without embedded credentials, a query, or a fragment.');
  if(u.protocol!=='https:'&&!(u.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(u.hostname)))throw Error('Use HTTPS, or HTTP for a local API on localhost.');
  return u;
}
$('model-form').onsubmit=async event=>{
  event.preventDefault();if(busy)return;
  try{
    const c={id:editing||crypto.randomUUID(),name:$('name').value.trim(),type:$('type').value,limitOutput:$('limit-output').checked,maxTokens:$('limit-output').checked?Number($('tokens').value):null,temperature:Number($('temperature').value)};
    if(!c.name)throw Error('Enter a card name.');
    if(c.limitOutput&&(!Number.isInteger(c.maxTokens)||c.maxTokens<1||c.maxTokens>1048576))throw Error('Use a whole-number token limit between 1 and 1,048,576.');
    if(c.type==='local'){c.model=$('model').value;c.context=Number($('context').value);}
    else{c.endpoint=endpoint($('endpoint').value.trim()).href;c.apiModel=$('api-model').value.trim();c.key=$('api-key').value.trim();c.format=$('format').value;if(!await chrome.permissions.request({origins:[new URL(c.endpoint).origin+'/*']}))throw Error('Endpoint permission was not granted.');}
    const old=cards.find(x=>x.id===editing);
    if(old?.type==='local'&&(c.type!=='local'||old.model!==c.model)&&!cards.some(x=>x.id!==old.id&&x.type==='local'&&x.model===old.model)){
      if(!confirm('Changing this model removes the old download first. The new model will require a separate Install click. Continue?'))return;
      await removeDownload(old);
    }
    cards=old?cards.map(x=>x.id===c.id?c:x):[...cards,c];if(!selected)selected=c.id;await persist();$('editor').close();render();notice('Model card saved.');
  }catch(e){$('form-error').textContent=cleanError(e);}
};
$('add').onclick=()=>edit();$('close').onclick=()=>$('editor').close();$('type').onchange=fields;$('model').onchange=fields;
$('cancel').onclick=()=>{aborter?.abort();terminate();notice('Canceled.');};
function memoryStatus(){
  $('memory-status').textContent=resident?'Model loaded in GPU memory'+(idleMinutes?' · unloads after '+idleMinutes+' idle minute'+(idleMinutes===1?'':'s'): ' until Turn Off')+'.':'No local model loaded. Installed files are kept.';
}
function release(reason){aborter?.abort();terminate();idleSince=0;notice(reason||'Model memory released.');}
function sendProgress(data){
  if(!activeJob)return;const now=Date.now();if(data.raw&&now-lastProgress<80&&!data.tokens)return;lastProgress=now;
  const model=cards.find(c=>c.id===selected)?.name||'';
  try{port?.postMessage({type:'progress',id:activeJob,...data,model});}catch{}
  $('progress-label').textContent=(data.phase||'Generating')+(data.tokens!=null?' · '+data.tokens+' tokens':data.raw?' · '+contract.partial(data.raw).length+' characters':'');memoryStatus();
}
async function infer({task}){
  if(busy)throw Error('Models is busy installing or editing a model.');
  if(task?.kind!=='manual'||!['answer','topic'].includes(task.mode))throw Error('Only manual prompts are supported.');
  const {options={}}=await chrome.storage.local.get('options');if(options.enabled===false)throw Error('The extension is turned off.');
  setBusy(true,'Working on '+(task.title||'your question'));aborter=new AbortController();lastProgress=0;

  try{
    const c=cards.find(x=>x.id===selected);if(!c)throw Error('Add and select a model in Models first.');
    const messages=contract.messages(task),schema=contract.schemaFor(task);let response;
    sendProgress({phase:'Preparing model'});
    if(c.type==='local'){
      if(!installed[c.model]||!await rpc('has',{model:c.model}))throw Error('Install the selected model in Models first.');
      response=await rpc('generate',{model:c.model,context:c.context,messages,maxTokens:c.limitOutput===true?c.maxTokens:null,temperature:c.temperature,schema});resident=true;
    }else response=await requestCompletion(c,messages,schema,aborter.signal,sendProgress);
    sendProgress({raw:response.raw,phase:'Finishing',tokens:response.usage?.completion_tokens});
    return {result:contract.parse(response.raw,task),usage:response.usage};
  }finally{aborter=null;setBusy(false);memoryStatus();}
}
function connect(){
  try{if(!chrome.runtime?.id)throw Error('Extension updated');port=chrome.runtime.connect({name:'ZBUltraModels'});}
  catch{notice('The extension was updated. Reload this Models tab to reconnect.');return;}
  const post=result=>{try{port.postMessage(result);}catch{}};
  port.onMessage.addListener(async r=>{
    if(r.type==='release'){release(r.reason);return;}
    if(r.type==='cancel'&&r.id===activeJob){aborter?.abort();terminate();return;}
    if(r.type!=='generate')return;
    if(activeJob){post({type:'result',id:r.id,error:'A model request is already running.'});return;}
    activeJob=r.id;
    try{const response=await infer(r);post({type:'result',id:r.id,...response});}
    catch(e){const error=cleanError(e);notice(error);post({type:'result',id:r.id,error});}
    finally{activeJob=null;}
  });
  port.onDisconnect.addListener(()=>{aborter?.abort();terminate();setTimeout(connect,1000);});
  post({type:'ready'});
}
function renderCatalog(){
  $('catalog-status').textContent=CATALOG.length+' browser models · downloads start only when you click Install';
  const nodes=CATALOG.map(m=>{
    const article=document.createElement('article');article.className='catalog-item';
    const info=document.createElement('div'),name=document.createElement('h3');name.textContent=m.label;
    const detail=document.createElement('p');detail.textContent=m.family+' · '+gb(m.downloadBytes)+' download · ~'+(m.vram_required_MB/1000).toFixed(1)+' GB GPU baseline';
    const link=document.createElement('a');link.href=m.model;link.target='_blank';link.rel='noopener noreferrer';link.textContent='View on Hugging Face ↗';
    info.append(name,detail,link);article.append(info,button('Add model',()=>edit(null,m.model_id)));return article;
  });$('catalog-results').replaceChildren(...nodes);
}
function idleSetting(options){idleMinutes=Math.max(0,Math.min(60,Number(options?.modelIdleMinutes??5)));$('modelIdleMinutes').value=String(idleMinutes);memoryStatus();}
function checkIdle(){if(!busy&&resident&&idleMinutes>0&&idleSince&&Date.now()-idleSince>=idleMinutes*60000)release('Idle model unloaded from memory. Installed files were kept.');}
$('modelIdleMinutes').onchange=async()=>{try{const result=await chrome.runtime.sendMessage({app:'ZBUltraSettings',patch:{modelIdleMinutes:Number($('modelIdleMinutes').value)}});if(!result.ok)throw Error(result.error);idleSetting(result.options);checkIdle();}catch(e){notice(cleanError(e));}};
chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local'||!changes.options)return;idleSetting(changes.options.newValue);if(changes.options.newValue?.enabled===false)release('Turned off — model memory released.');else checkIdle();});
document.addEventListener('visibilitychange',checkIdle);
async function init(){
  $('storage-origin').textContent=chrome.runtime.getURL('');
  $('storage-path').textContent=`On Windows the data is normally under your browser’s Profile Path → IndexedDB → chrome-extension_${chrome.runtime.id}_0.*. For Vivaldi, the profile is usually in %LOCALAPPDATA%\\Vivaldi\\User Data\\Default (or Profile 1, Profile 2, etc.).`;
  $('model').replaceChildren(...CATALOG.map(m=>{const o=document.createElement('option');o.value=m.model_id;o.textContent=m.label+' · '+gb(m.downloadBytes);return o;}));
  [cards,selected,installed]=await Promise.all([getPrivate('cards',[]),getPrivate('selected',''),getPrivate('installed',{})]);
  idleSetting((await chrome.storage.local.get('options')).options);
  // Cache validation reads metadata only; creating/opening a card never fetches model weights.
  for(const id of Object.keys(installed))if(!meta(id)||!await rpc('has',{model:id}))delete installed[id];
  await persist();render();connect();idleSince=Date.now();setInterval(checkIdle,1000);
  try{const adapter=await navigator.gpu?.requestAdapter();$('gpu').textContent=adapter?'WebGPU available · local models supported':'WebGPU unavailable · use an API model or enable hardware acceleration.';}catch{$('gpu').textContent='WebGPU unavailable in this browser.';}
  setInterval(()=>{try{port?.postMessage({type:'heartbeat'});}catch{}},20000);
}
init().catch(e=>notice(cleanError(e)));
