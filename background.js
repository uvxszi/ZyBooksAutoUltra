'use strict';
importScripts('element-picker.js');
const extensionURL=chrome.runtime.getURL('');
let settingsTail=Promise.resolve(),modelPort=null,opening=null,currentJob=null;
const modelPorts=new Set(),aiQueue=[],readyWaiters=new Set(),pickers=new Map();
const isExtension=s=>s.id===chrome.runtime.id&&s.url?.startsWith(extensionURL);
const isZyBooks=s=>s.id===chrome.runtime.id&&s.tab?.id&&s.frameId===0&&/^https:\/\/learn\.zybooks\.com\/zybook\/[^/]+\/chapter\/\d+\/section\/\d+/.test(s.url||'');
const post=(port,data)=>{try{port?.postMessage(data);}catch{}};
const toPage=(tabId,data)=>chrome.tabs.sendMessage(tabId,data,{frameId:0}).catch(()=>{});
function finishJob(job,response){if(job.finished)return;job.finished=true;clearTimeout(job.timer);job.reply(response);}
function cancelTab(tabId,reason='Stopped'){
  for(const job of aiQueue.filter(j=>tabId==null||j.tabId===tabId))finishJob(job,{ok:false,error:reason});
  if(currentJob&&(tabId==null||currentJob.tabId===tabId)){finishJob(currentJob,{ok:false,error:reason});post(modelPort,{type:'cancel',id:currentJob.id});}
}
function releaseModels(){cancelTab(null,'Turned off');for(const port of modelPorts)post(port,{type:'release',reason:'Turned off — model memory released.'});}
async function openModels(active=true){
  if(opening)return opening;
  opening=(async()=>{const url=chrome.runtime.getURL('models.html'),tabs=await chrome.tabs.query({url:url+'*'});if(tabs[0]){if(active)await chrome.tabs.update(tabs[0].id,{active:true});return tabs[0];}return chrome.tabs.create({url,active});})();
  try{return await opening;}finally{opening=null;}
}
async function readyHost(){
  if(modelPort)return;await openModels(false);if(modelPort)return;
  await new Promise((resolve,reject)=>{const done=()=>{clearTimeout(timer);readyWaiters.delete(done);resolve();};const timer=setTimeout(()=>{readyWaiters.delete(done);reject(Error('Open Models and try again.'));},20000);readyWaiters.add(done);});
}
async function pump(){
  if(currentJob)return;let job;while((job=aiQueue.shift())&&job.finished){}if(!job)return;currentJob=job;
  try{await readyHost();if(job.finished){currentJob=null;return pump();}post(modelPort,{type:'generate',id:job.id,task:job.task});}
  catch(e){finishJob(job,{ok:false,error:e.message});currentJob=null;pump();}
}
chrome.runtime.onConnect.addListener(port=>{
  if(port.name!=='ZBUltraModels'||!isExtension(port.sender)||!port.sender.url.startsWith(chrome.runtime.getURL('models.html')))return;
  modelPorts.add(port);
  port.onMessage.addListener(r=>{
    if(r.type==='ready'){
      if(!modelPort){modelPort=port;for(const done of readyWaiters)done();}else if(modelPort!==port)post(port,{type:'duplicate'});
      chrome.storage.local.get('options').then(({options})=>{if(options?.enabled===false)post(port,{type:'release',reason:'Turned off — model memory released.'});}).catch(()=>{});
    }
    if(port!==modelPort||!currentJob||currentJob.id!==r.id)return;
    if(r.type==='progress'&&!currentJob.finished)toPage(currentJob.tabId,{app:'ZBUltraStream',requestId:currentJob.task.requestId,raw:String(r.raw||'').slice(0,16777216),phase:String(r.phase||'Generating').slice(0,200),tokens:r.tokens,model:String(r.model||'').slice(0,100)});
    if(r.type==='result'){finishJob(currentJob,r.error?{ok:false,error:r.error}:{ok:true,result:r.result,usage:r.usage});currentJob=null;pump();}
  });
  port.onDisconnect.addListener(()=>{modelPorts.delete(port);if(modelPort!==port)return;modelPort=null;if(currentJob){finishJob(currentJob,{ok:false,error:'Models workspace closed. Reopen it to continue.'});currentJob=null;}for(const j of aiQueue.splice(0))finishJob(j,{ok:false,error:'Models workspace closed.'});});
});
async function stopPicker(tabId,notify=true,reason='Selection canceled.'){
  const session=pickers.get(tabId);if(!session)return;pickers.delete(tabId);clearTimeout(session.timer);
  await Promise.allSettled(session.frames.map(frameId=>chrome.scripting.executeScript({target:{tabId,frameIds:[frameId]},func:zuElementPicker,args:[{action:'stop'}]})));
  if(notify)await toPage(tabId,{app:'ZBUltraPicked',id:session.id,canceled:true,reason});
}
chrome.runtime.onMessage.addListener((m,sender,reply)=>{
  if(sender.id!==chrome.runtime.id)return;
  if(m?.app==='ZBUltraPick'&&m.action==='result'){
    const session=pickers.get(sender.tab?.id);if(!session||session.id!==m.id||!session.frames.includes(sender.frameId))return;
    stopPicker(sender.tab.id,false).then(()=>toPage(sender.tab.id,{app:'ZBUltraPicked',id:m.id,text:typeof m.text==='string'?m.text.slice(0,50000):'',truncated:!!m.truncated,canceled:!!m.canceled,reason:m.timeout?'Selection timed out after 20 seconds.':'Selection canceled.'}));reply({ok:true});return;
  }
  if(m?.app==='ZBUltraPick'&&isZyBooks(sender)){
    (async()=>{
      await stopPicker(sender.tab.id,false);if(m.action==='stop')return {ok:true};
      const {options={}}=await chrome.storage.local.get('options');if(options.enabled===false)throw Error('The extension is turned off.');
      if(m.action!=='start'||typeof m.id!=='string'||!/^[\w-]{1,80}$/.test(m.id))throw Error('Invalid element selection.');
      const session={id:m.id,frames:[],timer:null};pickers.set(sender.tab.id,session);
      const frames=await chrome.webNavigation.getAllFrames({tabId:sender.tab.id});let inaccessible=0;
      for(const frame of frames||[]){try{await chrome.scripting.executeScript({target:{tabId:sender.tab.id,frameIds:[frame.frameId]},func:zuElementPicker,args:[{id:m.id}]});session.frames.push(frame.frameId);}catch{inaccessible++;}}
      if(!session.frames.length)throw Error('Refresh this page before selecting an element.');
      session.timer=setTimeout(()=>stopPicker(sender.tab.id,true,'Selection timed out after 20 seconds.'),21000);return {ok:true,inaccessible};
    })().then(reply,e=>reply({ok:false,error:e.message}));return true;
  }
  if(m?.app==='ZBUltraSettings'&&(isExtension(sender)||isZyBooks(sender))){
    settingsTail=settingsTail.catch(()=>{}).then(async()=>{
      const {options={}}=await chrome.storage.local.get('options');
      for(const key of ['experimentalAI','challenges','labs','aiAttempts','gradingMs'])delete options[key];
      const allowed=['enabled','developerMode','autoChapter','nextChapter','stopOptional','participation','short','choice','animation','matching','tools','baseMs','jitterMinMs','jitterMaxMs','feedbackMs','animationMs','afterPageMs','lmsWaitMs','includeTopic','modelIdleMinutes'];
      for(const key of allowed)if(['boolean','number'].includes(typeof m.patch?.[key]))options[key]=m.patch[key];
      if(typeof m.patch?.topicLine==='string')options.topicLine=m.patch.topicLine.replace(/[\r\n]/g,' ').slice(0,160);
      await chrome.storage.local.set({options});reply({ok:true,options});
    }).catch(e=>reply({ok:false,error:e.message}));return true;
  }
  if(m?.app==='ZBUltraModels'&&m.action==='open'&&(isExtension(sender)||isZyBooks(sender))){openModels(true).then(()=>reply({ok:true}),e=>reply({ok:false,error:e.message}));return true;}
  if(m?.app==='ZBUltraFrames'&&isExtension(sender)){
    (async()=>{
      const frames=await chrome.webNavigation.getAllFrames({tabId:m.tabId}),all=await chrome.permissions.getAll();
      const origins=[...new Set((frames||[]).filter(f=>f.frameId&&/^https:\/\//.test(f.url)).map(f=>new URL(f.url).origin))];
      const missing=[],granted=[];for(const origin of origins){if(!await chrome.permissions.contains({origins:[origin+'/*']}))missing.push(origin+'/*');}
      // Only explicit optional grants; required zyBooks access remains part of installation.
      for(const pattern of all.origins||[])if(!chrome.runtime.getManifest().host_permissions.includes(pattern)&&origins.some(o=>pattern===o+'/*'))granted.push(pattern);
      return {ok:true,origins:missing,granted};
    })().then(reply,()=>reply({ok:false,origins:[],granted:[]}));return true;
  }
  if(m?.app!=='ZBUltraAI'||!isZyBooks(sender))return;
  if(m.action==='cancel'){cancelTab(sender.tab.id);reply({ok:true});return;}
  (async()=>{
    const {options={}}=await chrome.storage.local.get('options');if(options.enabled===false)throw Error('The extension is turned off.');
    const task=m.task;if(m.action!=='generate'||task?.category!=='manual'||task.kind!=='manual'||!['answer','topic'].includes(task.mode)||typeof task.prompt!=='string'||task.prompt.length>60000||typeof task.requestId!=='string'||task.requestId.length>80)throw Error('Only manual questions and topic prompts are supported.');
    if(aiQueue.filter(j=>!j.finished).length>=10)throw Error('The model queue is full.');
    aiQueue.push({id:crypto.randomUUID(),tabId:sender.tab.id,task,reply});pump();
  })().catch(e=>reply({ok:false,error:e.message}));return true;
});
chrome.webNavigation.onCommitted.addListener(d=>{if(d.frameId===0){cancelTab(d.tabId,'Page changed');stopPicker(d.tabId,false);}});
chrome.tabs.onRemoved.addListener(tabId=>{cancelTab(tabId,'Page closed');stopPicker(tabId,false);});
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&changes.options?.newValue?.enabled===false){releaseModels();for(const id of pickers.keys())stopPicker(id);}});

// Short-lived, per-tab handoff only for an explicitly started chapter run.
const route = path => path?.match(/^\/zybook\/([^/]+)\/chapter\/(\d+)\/section\/(\d+)\/?$/);
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.app !== 'ZBUltraResume' || !sender.tab?.id || sender.id !== chrome.runtime.id) return;
  const key = `resume:${sender.tab.id}`;
  (async () => {
    if (message.action === 'clear') { await chrome.storage.session.remove(key); return { ok: true }; }
    const { options = {} } = await chrome.storage.local.get('options');
    if (options.enabled === false || options.autoChapter !== true) { await chrome.storage.session.remove(key); return { ok: true, resume: null }; }
    if (message.action === 'stage') {
      // MessageSender.url can describe the original document after client-side navigation.
      const tab=await chrome.tabs.get(sender.tab.id);
      const from = new URL(tab.url || sender.url), current = route(from.pathname), target = route(message.resume?.expectedPath);
      const forward=current&&target&&(Number(target[2])>Number(current[2])||target[2]===current[2]&&Number(target[3])>Number(current[3]));
      if (from.origin !== 'https://learn.zybooks.com' || !current || !target || current[1] !== target[1] || !forward || (target[2]!==current[2]&&!options.nextChapter))
        return { ok: false, error:'The current page and next-section link did not match.' };
      await chrome.storage.session.set({ [key]: { ...message.resume, expires: Date.now() + 120000 } });
      return { ok: true };
    }
    if (message.action === 'consume') {
      const saved = (await chrome.storage.session.get(key))[key];
      await chrome.storage.session.remove(key);
      const url = new URL(sender.url);
      return { ok: true, resume: saved?.expectedPath === url.pathname && saved.expires > Date.now() ? saved : null };
    }
    return { ok: false };
  })().then(reply, () => reply({ ok: false }));
  return true;
});
chrome.tabs.onRemoved.addListener(tabId => chrome.storage.session.remove(`resume:${tabId}`));
chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area !== 'local' || !changes.options) return;
  const options = changes.options.newValue || {};
  if (options.enabled !== false && options.autoChapter === true) return;
  const values = await chrome.storage.session.get(null);
  await chrome.storage.session.remove(Object.keys(values).filter(key => key.startsWith('resume:')));
});
