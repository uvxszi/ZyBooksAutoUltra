// Runs in an isolated content-script world, including permitted embedded frames.
function zuElementPicker(request) {
  globalThis.__zuElementPicker?.stop();
  if(request.action==='stop')return {ok:true};
  const id=request.id;
  const outline=document.createElement('div');
  outline.id='zu-element-outline';outline.style.cssText='position:fixed;pointer-events:none;z-index:2147483647;border:2px solid #6de4c7;background:#6de4c724;border-radius:4px;display:none;box-sizing:border-box';
  document.documentElement.append(outline);
  let done=false,timer;
  function target(event){
    const el=event.target;if(!(el instanceof Element)||el.closest('#zb-ultra-host,#zu-element-outline'))return null;
    const select=el.closest('select,option');if(select)return select.closest('select');
    if(el.closest('input,textarea,[contenteditable="true"],button,[role="button"],script,style'))return null;
    const text=el.closest('pre,.ace_text-layer,.CodeMirror-code,.cm-content,p,li,td,th,h1,h2,h3,h4,legend,label,code')||el;
    if(['BODY','HTML'].includes(text.tagName)||text.querySelector('select,input,textarea,button'))return null;
    return (text.innerText||text.textContent||'').trim()?text:null;
  }
  function stop(){if(done)return;done=true;clearTimeout(timer);outline.remove();document.removeEventListener('pointermove',hover,true);document.removeEventListener('pointerdown',blockDropdown,true);document.removeEventListener('click',choose,true);document.removeEventListener('keydown',key,true);window.removeEventListener('pagehide',stop);globalThis.__zuElementPicker=null;}
  function send(value){stop();try{browser.runtime.sendMessage({app:'ZBUltraPick',action:'result',id,...value}).catch(()=>{});}catch{}}
  function hover(event){const el=target(event);if(!el){outline.style.display='none';return;}const r=el.getBoundingClientRect();Object.assign(outline.style,{display:'block',left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px'});}
  function choose(event){
    if(event.target?.closest?.('#zb-ultra-host')){send({canceled:true});return;}
    const el=target(event);event.preventDefault();event.stopImmediatePropagation();
    if(!el){send({canceled:true});return;}
    let text;
    if(el.matches('select')){
      const label=[...(el.labels||[])].map(l=>l.textContent.trim()).join(' ')||el.getAttribute('aria-label')||'Choices';
      const choices=[...el.options].filter(o=>!o.disabled&&!/^(pick|select|choose)(?:\s.*|\.{3}|…)?$/i.test(o.text.trim())).map(o=>o.text.trim()).filter(Boolean);
      text=label+'\n'+choices.map((t,i)=>`${String.fromCharCode(65+i)}. ${t}`).join('\n');
      if(!choices.length){send({canceled:true});return;}
    }else text=(el.innerText||el.textContent||'').trim();
    send({text:text.slice(0,50000),truncated:text.length>50000});
  }
  function key(event){if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();send({canceled:true});}}
  function blockDropdown(event){if(target(event)?.matches('select'))event.preventDefault();}
  document.addEventListener('pointermove',hover,true);document.addEventListener('pointerdown',blockDropdown,true);document.addEventListener('click',choose,true);document.addEventListener('keydown',key,true);window.addEventListener('pagehide',stop);
  timer=setTimeout(()=>send({canceled:true,timeout:true}),20000);
  globalThis.__zuElementPicker={id,stop};return {ok:true};
}
