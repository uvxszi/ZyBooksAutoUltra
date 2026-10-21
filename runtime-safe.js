(() => {
  'use strict';
  let invalid=false;
  const listeners=new Set();
  function invalidate(){if(invalid)return;invalid=true;for(const callback of listeners){try{callback();}catch{}}}
  function alive(){try{if(!chrome.runtime?.id)invalidate();}catch{invalidate();}return !invalid;}
  function handle(error){if(!alive()||/extension context invalidated/i.test(error?.message||String(error)))invalidate();return {ok:false,error:invalid?'The extension was reloaded. Refresh this zyBooks tab to reconnect.':error?.message||'Extension connection failed.'};}
  async function message(request){if(!alive())return handle(Error('Extension context invalidated'));try{return await chrome.runtime.sendMessage(request);}catch(error){return handle(error);}}
  async function options(){if(!alive())return handle(Error('Extension context invalidated'));try{return {ok:true,...await chrome.storage.local.get('options')};}catch(error){return handle(error);}}
  globalThis.ZBUltraRuntime=Object.freeze({message,options,alive,handle,onInvalid:callback=>listeners.add(callback)});
})();
