(() => {
  'use strict';
  const markup=`<div class="prompt-workspace">
    <p class="workspace-subtitle">Your question. Your model. Ready to copy.</p>
    <label class="toggle topic-toggle"><input type="checkbox" id="includeTopic">Include topic context</label>
    <div id="topic-row" hidden><label class="field-label" for="topic-line">Added before your question</label><div class="actions"><input id="topic-line" maxlength="160" aria-label="Topic context" placeholder="Introduction to Python programming: "><button id="topic-wand" title="Ask your model to identify the page topic" aria-label="Detect topic with AI">✦</button></div></div>
    <label class="field-label" for="prompt-text">Your question</label><textarea id="prompt-text" rows="6" placeholder="Paste your question and code here…" spellcheck="false"></textarea>
    <div class="actions compact"><button id="paste-question">Paste</button><button id="copy-prompt">Copy</button><button id="clear-prompt">Clear</button></div>
    <button id="copy-element">COPY ELEMENT FROM PAGE</button>
    <div class="actions prompt-actions"><button id="ask-model" class="primary">Ask model <span>→</span></button><button id="cancel-answer" disabled>Stop</button></div>
    <div id="inference" hidden><span class="pulse" aria-hidden="true"></span><span id="inference-info" role="status" aria-live="polite"></span></div>
    <p id="prompt-notice" class="hint" role="status" aria-live="polite">Paste a question, then ask your model.</p>
    <div id="answer-area" hidden><div class="top"><label class="field-label" for="answer-text">Answer</label><div class="actions answer-actions"><button id="copy-answer">Copy answer</button><button id="clear-answer" title="Clear the answer; stops answer generation if running">Clear answer</button></div></div><textarea id="answer-text" rows="7" readonly spellcheck="false" aria-label="Model answer" placeholder="The answer will appear here as it is generated…"></textarea></div>
  </div>`;
  const styles=`
    .workspace-subtitle{font-size:12px;color:#91aab8;margin:7px 0 18px}.prompt-workspace .field-label{display:block;color:#c2d5df;font-size:12px;margin:13px 0 7px}
    .prompt-workspace textarea,#topic-line{user-select:text;-webkit-user-select:text;display:block;width:100%;background:#09171f;color:#edf4f7;border:1px solid #354c59;border-radius:9px;padding:10px;font:13px/1.5 ui-monospace,Consolas,monospace;resize:vertical;min-height:34px}
    .prompt-workspace textarea:focus,#topic-line:focus{outline:2px solid #6de4c7;outline-offset:1px}.prompt-workspace .compact{margin-top:8px;flex-wrap:wrap}.prompt-workspace .compact button{font-size:11px;padding:6px 11px}
    .prompt-workspace .primary{flex:1;background:#6de4c7;border-color:#6de4c7;color:#09251e;font-weight:650;display:flex;justify-content:space-between}
    .prompt-workspace .hint{font-size:11px;color:#91aab8;line-height:1.5}.prompt-actions{margin-top:16px}#topic-line{flex:1;min-width:0}#topic-wand{color:#6de4c7;font-size:19px;padding:5px 12px}#copy-answer{font-size:11px;padding:4px 8px}.topic-toggle{margin-top:16px!important}#answer-area{margin-bottom:16px}#answer-text{max-height:320px}#prompt-notice{min-height:16px}#copy-element{width:100%;margin-top:12px;font-size:10px;letter-spacing:1px;background:#172e38;border-color:#335764;color:#b9dce3}
    .answer-actions button{font-size:11px;padding:4px 8px}#inference{display:flex;gap:8px;align-items:center;margin-top:12px;color:#9acbbf;font-size:11px;font-variant-numeric:tabular-nums}.pulse{height:6px;width:6px;flex-shrink:0;border-radius:50%;background:#6de4c7;animation:zu-pulse 1s ease-in-out infinite}@keyframes zu-pulse{50%{opacity:.3}}@media(prefers-reduced-motion:reduce){.pulse{animation:none}}
  `;
  function attach({root,options,save,message,onError}){
    const $=id=>root.getElementById(id);let busy=false,disposed=false,requestId='',mode='',pickId='',started=0,clock=null,phase='',model='',tokens=null;
    const notice=t=>$('prompt-notice').textContent=t;
    const safe=fn=>async(...args)=>{try{await fn(...args);}catch(e){onError?.(e);notice(e.message||'This action could not be completed.');}};
    function render(){
      $('includeTopic').checked=options().includeTopic;$('topic-row').hidden=!options().includeTopic;
      if(root.activeElement!==$('topic-line'))$('topic-line').value=options().topicLine;
      for(const id of ['ask-model','topic-wand','copy-element'])$(id).disabled=busy||disposed;
      $('cancel-answer').disabled=!busy;$('copy-element').textContent=pickId?'Cancel selection · Esc':'COPY ELEMENT FROM PAGE';
    }
    function metrics(){const seconds=Math.max(0,(Date.now()-started)/1000).toFixed(1),chars=$('answer-text').value.length;
      $('inference-info').textContent=[phase,model,seconds+'s',tokens!=null?tokens+' tokens':mode==='answer'?chars+' characters':''].filter(Boolean).join(' · ');
    }
    function fullPrompt(){return ($('includeTopic').checked?$('topic-line').value.trimEnd()+'\n\n':'')+$('prompt-text').value;}
    function append(text){$('prompt-text').value+=($('prompt-text').value.trim()?'\n\n':'')+text;}
    async function copy(value,field){if(!value){notice('There is no text to copy yet.');return;}try{await navigator.clipboard.writeText(value);notice('Copied.');}catch{field.focus();field.select();notice('Select the text and press Ctrl+C to copy.');}}
    function cancelPick(){if(!pickId)return;pickId='';message({app:'ZBUltraPick',action:'stop'});render();}
    async function request(nextMode){
      if(busy||disposed)return;cancelPick();let text;
      if(nextMode==='topic'){
        const titles=[...document.querySelectorAll('h1,.zybook-title,.chapter-title,.section-title')].map(e=>e.textContent.trim()).filter(Boolean).slice(0,12);
        const excerpts=[...document.querySelectorAll('.content-resource,.section-content')].filter(e=>e.getClientRects().length).slice(0,4).map(e=>e.innerText||e.textContent).join('\n').slice(0,10000);
        text=titles.join('\n')+'\n'+excerpts;if(!text.trim())text=document.title;
      }else{if(!$('prompt-text').value.trim()){notice('Paste or type a question first.');$('prompt-text').focus();return;}text=fullPrompt();}
      if(text.length>60000)throw Error('The question is too long. Shorten it before sending.');
      busy=true;mode=nextMode;const id=requestId=crypto.randomUUID();started=Date.now();phase='Queued';model='';tokens=null;
      if(mode==='answer'){$('answer-text').value='';$('answer-area').hidden=false;}
      $('inference').hidden=false;metrics();clock=setInterval(metrics,250);render();notice(mode==='topic'?'Identifying the topic…':'Waiting for the first text…');
      try{
        const r=await message({app:'ZBUltraAI',action:'generate',task:{category:'manual',kind:'manual',mode,prompt:text,requestId:id,title:mode==='topic'?'Page topic':'Your question'}});
        if(id!==requestId||disposed)return;if(!r?.ok)throw Error(r?.error||'No response from Models.');
        if(mode==='topic'){const line=String(r.result.topic||'Programming:').trimEnd()+' ';$('topic-line').value=line;await save({topicLine:line,includeTopic:true});notice('Topic added. You can edit it before asking.');}
        else{$('answer-text').value=r.result.answer;notice('Answer ready. Review it, then copy.');}
        phase='Done';if(r.usage?.completion_tokens!=null)tokens=r.usage.completion_tokens;metrics();
      }catch(e){if(id===requestId){phase='Stopped';metrics();throw e;}}
      finally{if(id===requestId){busy=false;clearInterval(clock);clock=null;render();}}
    }
    function cancel(){cancelPick();requestId='';busy=false;clearInterval(clock);clock=null;phase='Stopped';if(started)metrics();render();message({app:'ZBUltraAI',action:'cancel'});notice('Stopped. Any partial answer is kept.');}
    const receive=(event,sender)=>{
      if(sender.id!==chrome.runtime.id)return;
      if(event.app==='ZBUltraPicked'&&event.id===pickId){pickId='';render();if(event.canceled){notice(event.reason||'Selection canceled.');return;}if(event.text){append(event.text);notice(event.truncated?'Selected text added; long content was shortened.':'Selected element added to your question.');}return;}
      if(event.app!=='ZBUltraStream'||!busy||event.requestId!==requestId)return;
      phase=event.phase||'Generating';model=event.model||model;if(Number.isFinite(event.tokens))tokens=event.tokens;
      if(mode==='answer'&&event.raw){const field=$('answer-text'),nearEnd=field.scrollHeight-field.scrollTop-field.clientHeight<35;field.value=ZBUltraAIContract.partial(event.raw);if(nearEnd)field.scrollTop=field.scrollHeight;notice('Generating… you can stop at any time.');}metrics();
    };
    chrome.runtime.onMessage.addListener(receive);
    $('includeTopic').onchange=safe(()=>save({includeTopic:$('includeTopic').checked}));$('topic-line').onchange=safe(()=>save({topicLine:$('topic-line').value}));
    $('topic-wand').onclick=safe(()=>request('topic'));$('ask-model').onclick=safe(()=>request('answer'));$('cancel-answer').onclick=cancel;
    $('paste-question').onclick=safe(async()=>{try{const text=await navigator.clipboard.readText();if(text){append(text);notice('Pasted.');}else notice('The clipboard is empty.');}catch{$('prompt-text').focus();notice('Press Ctrl+V in the question box to paste.');}});
    $('clear-prompt').onclick=()=>{cancelPick();$('prompt-text').value='';$('prompt-text').focus();notice('Question cleared.');};
    $('clear-answer').onclick=()=>{if(busy&&mode==='answer')cancel();$('answer-text').value='';if(mode==='answer'&&started){phase='Cleared';metrics();}notice('Answer cleared.');};
    $('copy-prompt').onclick=safe(()=>copy(fullPrompt(),$('prompt-text')));$('copy-answer').onclick=safe(()=>copy($('answer-text').value,$('answer-text')));
    $('copy-element').onclick=safe(async()=>{if(pickId){cancelPick();notice('Selection canceled.');return;}pickId=crypto.randomUUID();const id=pickId;render();notice('Click text or a dropdown. Hover to highlight. Esc cancels; selection expires in 20 seconds.');const r=await message({app:'ZBUltraPick',action:'start',id});if(id!==pickId)return;if(!r?.ok){pickId='';render();throw Error(r?.error||'Selection could not start.');}if(r.inaccessible)notice('Click text or a dropdown. Some frames need Allow embedded elements in the popup. Esc cancels; 20-second timeout.');});
    render();return {render,cancel,get busy(){return busy;},dispose(){disposed=true;requestId='';pickId='';busy=false;clearInterval(clock);try{chrome.runtime.onMessage.removeListener(receive);}catch{}render();notice('The extension was reloaded. Refresh this tab to reconnect.');}};
  }
  globalThis.ZBUltraPrompt=Object.freeze({markup,styles,attach});
})();
