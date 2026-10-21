(() => {
  'use strict';
  if (globalThis.__ZB_ULTRA_CONTENT__) return;
  globalThis.__ZB_ULTRA_CONTENT__ = true;
  const api = ZBUltra, runtime = ZBUltraRuntime;
  let options = api.settings(), loaded = false, selected = null, picking = false, flow, starting = false, invalid = false, prompt, timer;
  const host = document.createElement('div');
  host.id = 'zb-ultra-host';
  host.style.cssText = 'all:initial;position:fixed;right:18px;bottom:18px;z-index:2147483646;color-scheme:dark;user-select:none;-webkit-user-select:none';
  const shadow = host.attachShadow({ mode: 'closed' });
  shadow.innerHTML = `
    <style>
      :host { all:initial; font:13px/1.5 system-ui,sans-serif; color:#eef5f7; user-select:none; -webkit-user-select:none; }
      * { box-sizing:border-box; user-select:none; -webkit-user-select:none; } button { font:inherit; cursor:pointer; border:1px solid #35434c; border-radius:9px; background:#202d37; color:#eef5f7; padding:8px 12px; }
      button:hover { background:#2b3e49; } button:focus-visible { outline:2px solid #6de4c7; outline-offset:3px; } button:disabled { opacity:.5;cursor:default; }
      #launcher { box-shadow:0 4px 24px #0005; background:#11252a; border-color:#34695f; border-radius:22px; }
      #panel { width:min(410px,calc(100vw - 36px)); max-height:85vh; overflow:auto; background:#111d26; border:1px solid #34444e; border-radius:16px; padding:18px; margin-bottom:10px; box-shadow:0 10px 40px #0005; }
      [hidden] { display:none!important; } h2 { margin:0; font-size:15px; font-weight:650; } p { margin:10px 0; color:#b4c6d0; }
      .top,.actions { display:flex;gap:8px;align-items:center; } .top { justify-content:space-between; } #close { padding:0 7px; }
      #start { background:#6de4c7;color:#09251e;border:0;font-weight:650; } #stop { color:#ffbbb5; } #phase { color:#6de4c7; }
      #current { min-height:20px; } #counts,#notice { font-size:12px; } #copy,#pick,#off { font-size:12px; padding:7px 9px; }
      .toggle { display:flex;align-items:center;gap:8px;margin:12px 0;color:#c9dce5;font-size:12px; } input { accent-color:#6de4c7; }
      #report { user-select:text;-webkit-user-select:text;width:100%;height:160px;margin-top:10px;background:#08141c;color:#d8e8ef;font:11px/1.4 monospace; }
      #outline { position:fixed; pointer-events:none; border:3px solid #6de4c7; border-radius:4px; background:#6de4c714; }
      #question-workspace { margin-top:16px; } #question-workspace>summary { cursor:pointer;font-size:13px;color:#c9dce5; } #automation { border-top:1px solid #30434e;padding-top:12px;margin-top:16px; } #automation summary { cursor:pointer;font-size:12px;color:#acc4d0; } #models {font-size:11px;padding:5px 9px;} #reload-note {background:#443523;padding:12px;border-radius:9px;color:#ffe2b8;font-size:12px;} .version{font-size:10px;color:#7f9dac;margin-top:12px}
      ${ZBUltraPrompt.styles}
    </style>
    <div id="outline" hidden></div>
    <section id="panel" hidden aria-label="ZyBooks AutoUltra controls">
      <div class="top"><h2>ZyBooks AutoUltra</h2><div class="actions"><button id="models">Models ↗</button><button id="close" aria-label="Collapse controls">×</button></div></div>
      <div id="reload-note" hidden>The extension was updated. Refresh this tab to reconnect.<p><button id="reload-page">Refresh page</button></p></div>
      <details id="question-workspace"><summary>AI question workspace</summary>${ZBUltraPrompt.markup}</details>
      <details id="automation" open><summary>Page automation</summary>
      <p id="phase" role="status" aria-live="polite">Ready</p><p id="current">Run the supported activities on this page.</p>
      <p id="counts"></p><div class="actions"><button id="start">Run activities</button><button id="stop" disabled>Stop run</button><button id="off">Turn Off</button></div>
      <label class="toggle"><input type="checkbox" id="autoChapter">Continue through this chapter</label>
      <div id="developer" hidden><div class="actions"><button id="pick">Pick activity</button><button id="copy">Copy diagnostics</button></div>
      <p id="notice"></p><textarea id="report" aria-label="Diagnostic report" readonly hidden></textarea></div>
      </details><div class="version">v1.7.1 · Made by uvxszi</div>
    </section>
    <button id="launcher" aria-expanded="false">ZU · AutoUltra</button>`;
  const $ = id => shadow.getElementById(id);
  function render() {
    if (!loaded || !options.enabled) { host.remove(); return; }
    if (!host.isConnected) document.documentElement.appendChild(host);
    const s = flow?.snapshot() || runner.snapshot();
    $('phase').textContent = s.phase;
    $('current').textContent = s.current || (s.animations ? `${s.animations} animations running` : 'Run the supported activities on this page.');
    $('counts').textContent = `${s.finished} completed · ${s.already} already done · ${s.skipped} need review${s.animations ? ` · ${s.animations} animations` : ''}`;
    $('start').disabled = invalid || s.running; $('stop').disabled = invalid || !s.running;
    $('launcher').textContent = s.running ? 'ZU · Running' : 'ZU · AutoUltra';
    $('autoChapter').checked = options.autoChapter; $('developer').hidden = !options.developerMode;
    if (!options.developerMode) { cancelPick(); $('report').hidden = true; }
    $('reload-note').hidden = !invalid; prompt?.render();
  }
  const runner = new api.Runner(render);
  const resumeMessage = (action, resume) => runtime.message({ app: 'ZBUltraResume', action, resume });
  flow = new ZBUltraFlow.Workflow(runner, { update: render, options: () => options,
    clearResume: () => resumeMessage('clear'), stageResume: async resume => {
      const result=await resumeMessage('stage', resume);
      if(!result.ok)throw Error(result.error || 'Reload this zyBooks tab and the extension to reconnect chapter navigation.');
    } });
  function open(value = true) { $('panel').hidden = !value; $('launcher').setAttribute('aria-expanded', String(value)); }
  function onError(error) { const result=runtime.handle(error); $('notice').textContent=result.error; }
  const safe = fn => (...args) => Promise.resolve().then(()=>{if(!runtime.alive())throw Error('Extension context invalidated');return fn(...args);}).catch(onError);
  runtime.onInvalid(() => {
    invalid=true;clearInterval(timer);runner.stop('Extension updated');flow.controller?.abort();flow.phase='Refresh this tab to reconnect';cancelPick();prompt?.dispose();render();
  });
  async function save(patch) {
    const result = await runtime.message({ app: 'ZBUltraSettings', patch });
    if (!result?.ok) throw Error(result?.error || 'Refresh this tab after reloading the extension.');
    options = api.settings(result.options); render();
  }
  async function stop(reason = 'Stopped', disableAdvance = true) {
    flow.stop(reason); cancelPick();
    if (disableAdvance) await save({ autoChapter: false });
  }
  async function start(raw = options, resume = null) {
    if (!loaded || !options.enabled || invalid || starting || flow.active || runner.state.running) return;
    starting = true;
    try {
      const data = await runtime.options(); if(!data.ok)throw Error(data.error); options = api.settings(data.options);
      if (!options.enabled) return;
      cancelPick(); open(); await flow.run(options, resume);
    } finally { starting = false; }
  }
  function pickTarget(el) {
    if (!(el instanceof Element) || el === host) return null;
    return el.closest(api.S.question) || el.closest(api.S.matching) || el.closest(api.S.activity) || el.closest(api.S.resource);
  }
  function hover(event) {
    const rect = pickTarget(event.target)?.getBoundingClientRect(); $('outline').hidden = !rect;
    if (rect) Object.assign($('outline').style, { left: `${rect.left}px`, top: `${rect.top}px`, width: `${rect.width}px`, height: `${rect.height}px` });
  }
  function choose(event) {
    if (event.composedPath().includes(host)) return;
    const target = pickTarget(event.target); if (!target) return;
    event.preventDefault(); event.stopImmediatePropagation(); selected = target;
    cancelPick(); open(); $('notice').textContent = 'Activity selected.';
  }
  function escape(event) { if (event.key === 'Escape') { cancelPick(); open(); $('notice').textContent = 'Selection canceled.'; } }
  function cancelPick() {
    picking = false; $('outline').hidden = true;
    document.removeEventListener('pointermove', hover, true); document.removeEventListener('click', choose, true); document.removeEventListener('keydown', escape, true);
  }
  async function pick() {
    if (!options.enabled || !options.developerMode) return;
    await stop('Stopped to select an activity'); picking = true; open();
    $('notice').textContent = 'Click an activity to inspect. Escape cancels.';
    document.addEventListener('pointermove', hover, true); document.addEventListener('click', choose, true); document.addEventListener('keydown', escape, true);
  }
  $('launcher').onclick = () => open($('panel').hidden);
  $('close').onclick = () => open(false);
  $('reload-page').onclick = () => location.reload();
  $('start').onclick = safe(() => start());
  $('stop').onclick = safe(() => stop());
  $('off').onclick = safe(async () => { options.enabled = false; prompt.cancel(); flow.stop('Turned off'); cancelPick(); render(); await save({ enabled: false, autoChapter: false }); });
  $('models').onclick = safe(() => runtime.message({app:'ZBUltraModels',action:'open'}));
  $('autoChapter').onchange = safe(() => save({ autoChapter: $('autoChapter').checked }));
  $('pick').onclick = safe(pick);
  $('copy').onclick = safe(async () => {
    if (!options.developerMode) return;
    const report = await diagnostics(); $('report').value = report; $('report').hidden = false;
    try { await navigator.clipboard.writeText(report); $('notice').textContent = 'Copied diagnostics.'; }
    catch { $('report').focus(); $('report').select(); $('notice').textContent = 'Press Ctrl+C to copy diagnostics.'; }
  });
  prompt = ZBUltraPrompt.attach({root:shadow,host,options:()=>options,save,message:runtime.message,onError});
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes.options) return;
    options = api.settings(changes.options.newValue);
    if (!options.enabled) { flow.stop('Turned off'); prompt.cancel(); cancelPick(); }
    render();
  });
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (sender.id !== chrome.runtime.id || message?.app !== 'ZBUltra') return;
    switch (message.action) {
      case 'status': reply({ ok: true, version: api.VERSION, state: flow.snapshot(), count: options.enabled ? api.discover().length : 0, picking, enabled: options.enabled }); break;
      case 'prompt': open(); $('question-workspace').open = true; $('prompt-text').focus(); reply({ok:true}); break;
      case 'start': start(message.options || options).catch(() => {}); reply({ ok: options.enabled }); break;
      case 'stop': stop().then(() => reply({ok:true}), () => reply({ok:false})); return true;
      case 'pick': safe(pick)(); reply({ ok: options.developerMode }); break;
      case 'report': if(!options.developerMode){reply({ok:false});break;} diagnostics().then(text=>reply({ok:true,text}),()=>reply({ok:false})); return true;
    }
  });
  async function diagnostics() {
    const data = JSON.parse(api.diagnostics(runner, selected));
    return JSON.stringify(data,null,2);
  }
  timer = setInterval(() => {
    if(!runtime.alive())return;
    if (!options.enabled) return;
    if (runner.state.running && location.href !== runner.url) flow.stop('Stopped because the page changed');
    if (selected && !selected.isConnected) selected = null;
  }, 300);
  window.addEventListener('pagehide', () => { cancelPick(); prompt.dispose(); if (!flow.navigating) flow.stop('Page closed'); });
  (async () => {
    const data = await runtime.options(); if(!data.ok)throw Error(data.error); options = api.settings(data.options); loaded = true; render();
    const result = await resumeMessage('consume');
    if (result.resume && options.enabled && options.autoChapter) {
      await new Promise(resolve => setTimeout(resolve, 900));
      await start({ ...result.resume.options, ...options }, result.resume);
    }
  })().catch(error => { loaded = true; onError(error); render(); });
})();
