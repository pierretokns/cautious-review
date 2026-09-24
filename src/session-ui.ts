import { validateObservation } from './session-diagnostics.js';

// Diagnostics are inert until a reviewer explicitly starts them. These records
// are schema hints for adapter development, never authority to execute an action.
(() => {
 const ui = document.getElementById('cautious-review')?.shadowRoot;
 if (!ui) return;
 const panel = document.createElement('details');
 panel.id = 'session-diagnostics';
 panel.innerHTML = `<summary>Browser-session diagnostics (no admin key)</summary>
 <p>Help connect Cautious Review to your existing Greenhouse session. Start recording, then browse applications and open a résumé normally. Recording makes no requests and performs no candidate actions.</p>
 <p>Only request methods, redacted path templates, field names/types and status codes are recorded. Cookies, tokens, headers, candidate values and document contents are excluded. Stops after ten minutes or 100 observations.</p>
 <div class="row"><button id="session-start">Start diagnostics</button><button id="session-stop" disabled>Stop</button><button id="session-export" disabled>Export diagnostics</button><button id="session-clear">Clear diagnostics</button></div>
 <p id="session-status" role="status">Off. Nothing recorded. Direct session actions are not implemented yet.</p>`;
 ui.querySelector('section')!.append(panel);
 const start = panel.querySelector<HTMLButtonElement>('#session-start')!;
 const stop = panel.querySelector<HTMLButtonElement>('#session-stop')!;
 const save = panel.querySelector<HTMLButtonElement>('#session-export')!;
 const status = panel.querySelector<HTMLElement>('#session-status')!;
 const records: NonNullable<ReturnType<typeof validateObservation>>[] = [];
 let active = false;
 let timer: ReturnType<typeof setTimeout> | undefined;
 const channel = 'cautious-review-session-diagnostics';
 const command = (value: 'stop') => window.postMessage({channel,command:value}, location.origin);
 function render(note = '') {
  start.disabled = active; stop.disabled = !active; save.disabled = records.length === 0;
  status.textContent = `${active ? 'Recording' : 'Stopped'} · ${records.length} sanitized observations. ${note}`;
 }
 function finish(note = '') {
  active = false; clearTimeout(timer); command('stop'); render(note);
 }
 start.addEventListener('click', event => {
  if (!event.isTrusted) return;
  records.length = 0; active = true; // MAIN observer requires this same trusted button click.
  timer = setTimeout(() => finish('Ten-minute limit reached.'), 10 * 60 * 1000);
  render('Browse Greenhouse normally. No actions are initiated by diagnostics.');
 });
 stop.addEventListener('click', event => { if(event.isTrusted) finish('Ready to export or clear.'); });
 panel.querySelector('#session-clear')!.addEventListener('click', event => {
  if (!event.isTrusted) return;
  records.length = 0; finish('All diagnostic records cleared.');
 });
 window.addEventListener('message', event => {
  if (!active || event.source !== window || event.origin !== location.origin || event.data?.channel !== channel) return;
  if (event.data.kind === 'state' && event.data.active === false) { finish('Observer stopped.'); return; }
  if (event.data.kind !== 'observation') return;
  // Page scripts can spoof bridge messages. Canonical validation strips extra
  // properties and permits no arbitrary strings or scalar candidate values.
  const observation = validateObservation(event.data.observation);
  if (!observation) return;
  records.push(observation);
  if (records.length >= 100) finish('100-observation limit reached.');
  else render();
 });
 save.addEventListener('click', event => {
  if (!event.isTrusted || records.length === 0) return;
  finish('Export contains sanitized schema hints, not verified API contracts.');
  const report = {schemaVersion:1,extensionVersion:'0.3.1',mode:'passive-session-diagnostics',
   verification:'Untrusted observed schema hints only. No session action adapter or real-account validation.',
   observations:records.map(validateObservation).filter(Boolean)};
  const url = URL.createObjectURL(new Blob([JSON.stringify(report,null,2)+'\n'], {type:'application/json'}));
  const link = document.createElement('a'); link.href = url; link.download = 'cautious-review-session-diagnostics.json';
  link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
 });
 window.addEventListener('pagehide', () => { records.length = 0; finish(); });
})();
