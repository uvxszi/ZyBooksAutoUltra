'use strict';
const $ = id => document.getElementById(id);
const activityKeys = ['short', 'choice', 'animation', 'matching', 'tools'];
const booleanKeys = [...activityKeys, 'participation', 'autoChapter', 'nextChapter', 'stopOptional', 'developerMode'];
const numberKeys = ['baseMs', 'jitterMinMs', 'jitterMaxMs', 'feedbackMs', 'animationMs', 'afterPageSeconds', 'lmsWaitSeconds', 'modelIdleMinutes'];
let options = ZBUltra.settings(), tabId, reportText = '', connected = false, frameOrigins = [], grantedFrames = [], changingPower = false;
function readOptions() {
  const data = { ...options, ...Object.fromEntries(booleanKeys.map(key => [key, $(key).checked])) };
  for (const key of numberKeys) data[key] = Number($(key).value);
  data.afterPageMs = data.afterPageSeconds * 1000; data.lmsWaitMs = data.lmsWaitSeconds * 1000;
  return ZBUltra.settings(data);
}
function showOptions() {
  for (const key of booleanKeys) $(key).checked = options[key];
  for (const key of numberKeys) $(key).value = key === 'afterPageSeconds' ? options.afterPageMs / 1000 : key === 'lmsWaitSeconds' ? options.lmsWaitMs / 1000 : options[key];
  $('power').setAttribute('aria-pressed', String(options.enabled));
  $('power').setAttribute('aria-label', options.enabled ? 'Turn off extension' : 'Turn on extension');
  $('power').title = options.enabled ? 'Turn off extension' : 'Turn on extension';
  $('developer').hidden = !options.developerMode;
  $('delay-label').textContent = `${((options.baseMs + options.jitterMinMs)/1000).toFixed(1)}–${((options.baseMs + options.jitterMaxMs)/1000).toFixed(1)}s between problems`;
}
async function send(action, extra = {}) {
  if (tabId == null) throw new Error('Open a zyBooks section first.');
  return chrome.tabs.sendMessage(tabId, { app: 'ZBUltra', action, ...extra });
}
function offline() {
  connected = false; $('dot').classList.remove('connected');
  $('phase').textContent = options.enabled ? 'Open a zyBooks section' : 'Turned off';
  $('current').textContent = options.enabled ? 'Refresh your zyBooks tab after installing or updating.' : 'Use the power button to turn the extension on.';
  for (const id of ['run','stop','pick','copy','open-prompt']) $(id).disabled = true;
}
async function refresh() {
  try {
    const data = await send('status'); if (!data?.ok) return offline();
    if (data.version !== ZBUltra.VERSION) { offline(); $('phase').textContent = 'Refresh this zyBooks tab'; $('current').textContent = 'The extension was updated. Reload the page to activate version ' + ZBUltra.VERSION + '.'; return; }
    connected = true; const s = data.state;
    $('dot').classList.toggle('connected', options.enabled);
    $('phase').textContent = options.enabled ? s.phase : 'Turned off';
    $('current').textContent = !options.enabled ? 'Page controls are hidden. Use power to turn them on.' : s.current || `${data.count} supported items · ${s.animations || 0} active animations`;
    $('counts').textContent = `${s.finished} completed · ${s.already} already done · ${s.skipped} need review${s.played ? ` · ${s.played} unconfirmed` : ''}`;
    const hasActivities=options.animation||options.participation&&['short','choice','matching','tools'].some(k=>options[k]);
    $('run').disabled = !options.enabled || s.running || !hasActivities;
    $('open-prompt').disabled = !options.enabled;
    $('stop').disabled = !options.enabled || !s.running;
    $('pick').disabled = !options.enabled; $('copy').disabled = !options.enabled;
    $('logs').replaceChildren(...s.logs.slice().reverse().map(log => { const li = document.createElement('li'); li.textContent = log.message; return li; }));
  } catch { offline(); }
}
async function persist(patch) {
  const result = await chrome.runtime.sendMessage({ app:'ZBUltraSettings', patch });
  if (!result?.ok) throw Error(result?.error || 'Reload the extension to finish updating.');
  options = ZBUltra.settings(result.options); showOptions(); await refresh();
}
for (const key of [...booleanKeys, ...numberKeys]) $(key).addEventListener('change', async () => {
  if (numberKeys.includes(key) && (!$(key).value || !$(key).reportValidity())) return;
  const mapped = {afterPageSeconds:'afterPageMs',lmsWaitSeconds:'lmsWaitMs'}[key] || key;
  await persist({[mapped]:readOptions()[mapped]});
});
$('power').onclick = async () => {
  if (changingPower) return;
  const enabled = !options.enabled; changingPower = true; $('power').disabled = true;
  try { await persist({ enabled, autoChapter:false }); }
  catch (e) { $('notice').textContent = e.message; }
  finally { changingPower = false; $('power').disabled = false; }
};
$('run').onclick = async () => {
  try { if (!numberKeys.every(key => $(key).reportValidity())) return; const {enabled,...patch}=readOptions(); await persist(patch); await send('start'); await refresh(); }
  catch { offline(); }
};
$('stop').onclick = async () => { try { await send('stop'); await persist({ autoChapter: false }); } catch { offline(); } };
$('models').onclick = () => chrome.runtime.sendMessage({app:'ZBUltraModels',action:'open'});
$('open-prompt').onclick = async () => {try{await send('prompt');window.close();}catch{offline();}};
async function framePermissions(){
  if(tabId==null)return;const result=await chrome.runtime.sendMessage({app:'ZBUltraFrames',tabId});frameOrigins=result?.origins||[];grantedFrames=result?.granted||[];
  $('allow-frames').hidden=!frameOrigins.length;$('disallow-frames').hidden=!grantedFrames.length;$('frame-note').hidden=!frameOrigins.length&&!grantedFrames.length;
}
$('allow-frames').onclick=async()=>{try{const granted=await chrome.permissions.request({origins:frameOrigins});$('notice').textContent=granted?'Embedded elements allowed. Use Copy Element on the page.':'Permission was not granted.';await framePermissions();}catch(e){$('notice').textContent=e.message;}};
$('disallow-frames').onclick=async()=>{try{if(grantedFrames.length)await chrome.permissions.remove({origins:grantedFrames});$('notice').textContent='Additional embedded-element access removed.';await framePermissions();}catch(e){$('notice').textContent=e.message;}};
$('pick').onclick = async () => { try { await send('pick'); window.close(); } catch { offline(); } };
$('copy').onclick = async () => {
  try {
    const result = await send('report'); if (!result.ok) return;
    reportText = result.text; $('report').value = reportText; $('report').hidden = false; $('download').hidden = false;
    try { await navigator.clipboard.writeText(reportText); $('notice').textContent = 'Copied diagnostics.'; }
    catch { $('report').focus(); $('report').select(); $('notice').textContent = 'Press Ctrl+C to copy diagnostics.'; }
  } catch { offline(); }
};
$('download').onclick = () => {
  const url = URL.createObjectURL(new Blob([reportText], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'ZyBooks-AutoUltra-diagnostic.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
};
function modelSummary(value) { $('model-summary').textContent = value ? `Selected model: ${value.name} · ${value.type === 'local' ? 'browser' : 'API'}` : 'No AI model selected. Open Models to add one.'; }
chrome.storage.onChanged.addListener((changes, area) => { if (area !== 'local') return; if (changes.options) { options = ZBUltra.settings(changes.options.newValue); showOptions(); refresh(); } if (changes.modelSummary) modelSummary(changes.modelSummary.newValue); });
(async () => {
  const data = await chrome.storage.local.get(['options','modelSummary']); options = ZBUltra.settings(data.options); showOptions(); modelSummary(data.modelSummary);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url && /^https:\/\/learn\.zybooks\.com\//.test(tab.url)) tabId = tab.id;
  if (tabId != null) await framePermissions();
  await refresh(); setInterval(() => { if (connected) refresh(); }, 750);
})().catch(offline);
