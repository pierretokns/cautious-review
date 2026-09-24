(() => {
 const root = document.getElementById('cautious-review')?.shadowRoot;
 if (!root || root.querySelector('#cr-assist')) return;
 const section = document.createElement('details'); section.id = 'cr-assist';
 section.innerHTML = `<summary>Evidence, clean reading & bulk import</summary>
 <p>Local rules, not a hosted model. Work claims are self-reported; absence is not failure.</p>
 <label>Job criteria: one per line; use | for alternatives<textarea id="cr-criteria" aria-label="Job criteria" placeholder="Kubernetes&#10;Terraform&#10;evaluation|benchmark"></textarea></label>
 <div class="row"><button id="cr-analyze">Analyze indexed résumé</button><button id="cr-clean">Clean reading view</button></div>
 <div id="cr-evidence" aria-live="polite"></div>
 <details><summary>Import résumé text in bulk</summary>
 <p>JSON array of {url, name, text}. URLs must belong to this Greenhouse origin. Import never queues decisions. Up to 1,000 records / 5 MB per file; review account scope first.</p>
 <input id="cr-import" type="file" accept=".json,application/json" aria-label="Import résumé JSON"></details>
 <div class="row"><button id="cr-export">Export queue & audit JSON</button><button id="cr-report" disabled>Export evidence report</button></div>
 <small>Exports contain confidential applicant information. No automatic uploads. Visual fonts and AI authorship cannot be determined from plain text.</small>`;
 root.querySelector('section')!.append(section);
 root.querySelector('h2 small')!.textContent = '0.2.0 preview';
 const $ = <T extends Element = HTMLElement>(q: string) => root.querySelector<T>(q)!;
 let generation = 0, route = location.href, lastReport: unknown, busy = false;
 const status = (s: string) => { $('#status').textContent = s; };
 async function rpc(type: string, data: Record<string, unknown> = {}) {
  const url = location.href, response = await chrome.runtime.sendMessage({ type, url, ...data });
  if (url !== location.href) throw Error('Application changed; discard this result and retry');
  if (!response?.ok) throw Error(response?.error ?? 'Extension unavailable');
  return response.value;
 }
 async function run(f: () => Promise<void>) {
  if (busy) return; busy = true;
  try { await f(); } catch (e) { status(e instanceof Error ? e.message : 'Local operation failed'); }
  finally { busy = false; }
 }
 function reset() { ++generation; lastReport = undefined; $<HTMLButtonElement>('#cr-report').disabled = true; $('#cr-evidence').replaceChildren(); }
 function download(filename: string, value: unknown) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000);
 }
 $('#cr-analyze').addEventListener('click', e => {
  if (!e.isTrusted) return;
  void run(async () => {
   const ticket = ++generation, report = await rpc('analyze', { criteria: $<HTMLTextAreaElement>('#cr-criteria').value });
   if (ticket !== generation) return;
   const nodes: HTMLElement[] = [];
   const labels: Record<string, string> = { not_established: 'Not established in this text', mention: 'Mention only', work_claim: 'Self-reported work claim', possible_negation: 'Possible negation or conflict — review' };
   for (const criterion of report.criteria) {
    const article = document.createElement('article'), heading = document.createElement('strong');
    heading.textContent = `${criterion.criterion}: ${labels[criterion.status]}`; article.append(heading);
    for (const p of criterion.passages) {
     const source = document.createElement('small'); source.textContent = `via “${p.via}”; source characters ${p.start}–${p.end}`;
     const quote = document.createElement('p'); quote.textContent = p.quote; article.append(source, quote);
    }
    nodes.push(article);
   }
   const diagnostic = document.createElement('article');
   diagnostic.textContent = `Document diagnostics: ${report.diagnostics.words} words, ${report.diagnostics.bullets} bullet lines. ` +
    (report.diagnostics.flags.length ? report.diagnostics.flags.map((f: any) => `${f.code} (${f.count}): ${f.explanation}`).join('\n') : 'No configured text-format flags. This is not a quality endorsement.');
   nodes.push(diagnostic); $('#cr-evidence').replaceChildren(...nodes);
   lastReport = report; $<HTMLButtonElement>('#cr-report').disabled = false;
   status(`Evidence ready · ${report.engineVersion} · no decision made.`);
  });
 });
 $('#cr-clean').addEventListener('click', e => {
  if (e.isTrusted) void run(async () => {
   reset(); const doc = await rpc('document'); if (!doc) throw Error('Index this résumé first');
   const text = document.createElement('pre'); text.style.cssText = 'white-space:pre-wrap;font:15px/1.6 system-ui;max-height:360px;overflow:auto';
   text.textContent = doc.text; $('#cr-evidence').replaceChildren(text); status('Normalized reading view. Original résumé is unchanged.');
  });
 });
 $('#cr-import').addEventListener('change', e => {
  if (!e.isTrusted) return;
  const input = $<HTMLInputElement>('#cr-import'), file = input.files?.[0]; if (!file) return;
  void run(async () => {
   if (file.size > 5000000) throw Error('Import file exceeds 5 MB');
   const records: unknown = JSON.parse(await file.text());
   const result = await rpc('import', { records }); reset(); input.value = '';
   status(`Imported ${result.imported} résumé records locally. No decisions queued.`);
  });
 });
 $('#cr-export').addEventListener('click', e => {
  if (e.isTrusted) void run(async () => { const data = await rpc('export'); download('cautious-review-queue.json', data); status('Local queue exported. It has NOT been executed in Greenhouse.'); });
 });
 $('#cr-report').addEventListener('click', e => { if (e.isTrusted && lastReport) download('cautious-review-evidence.json', lastReport); });
 // Never leave a report from the previous application on screen.
 $('#clear').addEventListener('click', () => reset());
 $('#capture').addEventListener('click', () => reset());
 setInterval(() => { if (route !== location.href) { route = location.href; reset(); } }, 500);
})();
