(() => {
  if (document.getElementById("cautious-review")) return;
  const host = document.createElement("aside");
  host.id = "cautious-review";
  const ui = host.attachShadow({ mode: "open" });
  // Static markup only. Applicant-provided strings are always rendered with textContent.
  ui.innerHTML = `<style>
    :host { all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483647;width:360px;font:14px/1.45 system-ui;color:#16202c; }
    :host([hidden]) { display:none !important; }
    section { background:white;border:1px solid #cbd5e1;border-radius:12px;padding:14px;box-shadow:0 8px 32px #0003;max-height:80vh;overflow:auto; }
    h2 { font-size:17px;margin:0 0 4px; } p { margin:5px 0 9px; } small { color:#4b5563; }
    button,select,input,textarea { font:inherit;box-sizing:border-box; } button { padding:6px 9px;cursor:pointer; }
    input,textarea,select { width:100%;padding:6px;margin:5px 0; } textarea { min-height:70px; }
    .row { display:flex;gap:5px;flex-wrap:wrap;margin:7px 0; } label { display:block; } label input { width:auto; }
    #status { min-height:20px; } #results { max-height:220px;overflow:auto; } article { border-top:1px solid #dde3eb;padding:8px 0; }
    a { color:#16499a; } article p { white-space:pre-wrap; } details { margin-top:8px; } button:disabled { cursor:not-allowed; }
  </style><section>
    <h2>Cautious Review <small>0.3.2 preview</small></h2>
    <p><strong>Local review queue.</strong> Execute reviewed decisions in Live Review.</p><button id="open-live">Open Live Review & résumé retrieval</button>
    <label><input type="checkbox" id="enabled"> Enable keyboard review on this page</label>
    <small>Alt+A advance · Alt+M maybe · Alt+R reject · Alt+U undo · Alt+J/K navigation</small>
    <div class="row"><button id="advance">Queue advance</button><button id="maybe">Queue maybe</button><button id="reject">Queue reject</button><button id="undo">Undo current</button></div>
    <label>Rejection reason (Alt+1–7)<select id="reason"><option value="">Choose a reason</option></select></label>
    <div id="status" role="status" aria-live="polite">Open a specific job application to queue decisions.</div>
    <details><summary>Index résumé text locally</summary>
      <p>No automatic page scraping. Select résumé text on the page or paste it here. Embedded PDFs are not extracted in this preview.</p>
      <textarea id="resume" aria-label="Paste resume text" placeholder="Paste résumé text, or select it on the page"></textarea>
      <button id="capture">Index selected / pasted text</button>
    </details>
    <label>Search locally indexed text<input id="search" aria-label="Local search" placeholder="Kubernetes Terraform"></label>
    <div id="results"></div>
    <div class="row"><button id="queue-list">View local queue</button><button id="clear">Clear local data</button></div>
    <small>No cloud inference. Clear local data before switching Greenhouse accounts. Local cache and queue expire after seven days.</small>
  </section>`;
  document.body.append(host);
  const $ = <T extends Element = HTMLElement>(selector: string) => ui.querySelector<T>(selector)!;
  const reason = $<HTMLSelectElement>("#reason"), enabled = $<HTMLInputElement>("#enabled");
  const reasons = ["Required skills not demonstrated", "Relevant work not demonstrated", "Role scope mismatch", "Seniority mismatch", "Explicit on-site answer mismatch", "Explicit sponsorship answer mismatch", "Other — reviewer reason"];
  for (const label of reasons) { const opt = document.createElement("option"); opt.textContent = label; opt.value = label; reason.append(opt); }
  function ownedFacts() {
    const facts:Record<string,string>[]=[];
    // Only Greenhouse action forms and selected navigation. Never scan résumé HTML,
    // arbitrary JSON, window globals, or applicant prose for identifier-like numbers.
    for(const form of document.querySelectorAll<HTMLFormElement>('form[action]')) {
      const action=new URL(form.action,location.href);
      const match=action.pathname.match(/^\/applications\/([1-9]\d*)\/(reject|advance|move|unreject)\/?$/);
      if(action.origin!==location.origin||!match||form.closest('[data-testid="resume"],.resume,[contenteditable],iframe'))continue;
      const fact:Record<string,string>={applicationId:match[1]};
      for(const [name,key] of [['candidate_id','candidateId'],['job_id','jobId'],['from_stage_id','stageId']]) {
        const fields=form.querySelectorAll<HTMLInputElement>(`input[type="hidden"][name="${name}"]`);
        for(const field of fields)facts.push({[key]:field.value});
      }
      facts.push(fact);
    }
    for(const a of document.querySelectorAll<HTMLAnchorElement>('nav a[aria-current="page"][href]')) {
      const u=new URL(a.href,location.href);if(u.origin!==location.origin)continue;
      const m=u.pathname.match(/^\/(people|candidates|applications)\/([1-9]\d*)(?:\/|$)/);
      if(m)facts.push({[m[1]==='applications'?'applicationId':'candidateId']:m[2]});
      for(const name of ['application_id','job_application_id'])for(const id of u.searchParams.getAll(name))facts.push({applicationId:id});
    }
    return facts;
  }
  $("#open-live").addEventListener("click", e => {
    if (!e.isTrusted) return;
    void (async () => {
      try {
        const response = await chrome.runtime.sendMessage({ type: 'open-live', facts: ownedFacts() });
        if (!response?.ok) status(response?.error ?? "Could not open Live Review. Reload this page and try again.");
        else status("Live Review opened. Confirm the selected application there before any action.");
      } catch {
        status("Could not contact the extension. Reload this page and try again.");
      }
    })();
  });
  let currentUrl = location.href, busy = false, generation = 0;
  function status(message: string) { $("#status").textContent = message; }
  async function send(type: string, data: Record<string, unknown> = {}) {
    const response = await chrome.runtime.sendMessage({ type, url: location.href, ...data });
    if (!response?.ok) throw Error(response?.error ?? "Extension unavailable: reload this page");
    return response.value;
  }
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    busy = true;
    try { await fn(); } catch (error) { status(error instanceof Error ? error.message : "Local operation failed"); }
    finally { busy = false; }
  }
  async function queue(decision: string) {
    if (!enabled.checked) { status("Enable keyboard review before queueing."); return; }
    if (decision === "reject" && !reason.value) { reason.focus(); status("Select a reason, then queue rejection."); return; }
    await send("queue", { decision, reason: reason.value });
    status(`${decision.toUpperCase()} queued locally. Greenhouse is unchanged.`);
  }
  for (const action of ["advance", "maybe", "reject"]) {
    $(`#${action}`).addEventListener("click", e => { if (e.isTrusted) void run(() => queue(action)); });
  }
  $("#undo").addEventListener("click", e => {
    if (e.isTrusted) void run(async () => { const r = await send("undo"); status(r.changed ? "Previous local decision restored." : "No queued decision to undo."); });
  });
  $("#capture").addEventListener("click", e => {
    if (e.isTrusted) void run(async () => {
      const text = $<HTMLTextAreaElement>("#resume").value.trim() || window.getSelection()?.toString().trim() || "";
      const name = document.querySelector("[data-testid='candidate-name'],.candidate-name,h1")?.textContent?.trim() ?? "Candidate";
      await send("capture", { text, name }); status("Résumé text indexed locally.");
      $<HTMLTextAreaElement>("#resume").value = "";
    });
  });
  function showRecords(records: { title: string; text: string; url?: string }[]) {
    const nodes = records.map(record => {
      const article = document.createElement("article"), title = document.createElement(record.url ? "a" : "strong");
      title.textContent = record.title;
      if (record.url && title instanceof HTMLAnchorElement) title.href = record.url;
      const evidence = document.createElement("p"); evidence.textContent = record.text;
      article.append(title, evidence); return article;
    });
    $("#results").replaceChildren(...nodes);
  }
  let debounce: ReturnType<typeof setTimeout>;
  $<HTMLInputElement>("#search").addEventListener("input", () => {
    clearTimeout(debounce); const ticket = ++generation;
    debounce = setTimeout(async () => {
      try {
        const hits = await send("search", { query: $<HTMLInputElement>("#search").value });
        if (ticket !== generation) return;
        showRecords(hits.map((hit: any) => ({ title: `${hit.document.name} · ${hit.matched.length}/${hit.total} query terms`, url: hit.document.url, text: hit.evidence.join("\n\n") })));
        status(`${hits.length} local text matches. This is not a qualification score.`);
      } catch (e) { status(e instanceof Error ? e.message : "Search failed"); }
    }, 200);
  });
  $("#queue-list").addEventListener("click", () => void run(async () => {
    ++generation;
    const entries = await send("list");
    showRecords(entries.map((r: any) => ({ title: `Application ${r.applicationId} · ${r.decision}`, url: r.url, text: `${r.reason ?? "Human review"}\n${r.createdAt}` })));
    status(`${entries.length} local decisions. No actions sent to Greenhouse.`);
  }));
  $("#clear").addEventListener("click", e => {
    if (e.isTrusted && window.confirm("Delete ALL Cautious Review local text, decisions, and audit entries? Greenhouse is unaffected.")) {
      void run(async () => { await send("clear"); ++generation; showRecords([]); status("All local data cleared."); });
    }
  });
  function navigate(direction: "next" | "previous") {
    const exact = direction === "next" ? /^next candidate$/i : /^(previous|prev) candidate$/i;
    const links = [...document.querySelectorAll<HTMLAnchorElement>("a[href]")].filter(a => {
      const label = a.getAttribute("aria-label") ?? a.getAttribute("title") ?? a.textContent?.trim() ?? "";
      const u = new URL(a.href, location.href);
      return exact.test(label) && a.getClientRects().length > 0 && u.origin === location.origin && /^\/(people|candidates|applications)\/[1-9]\d*(?:\/|$)/.test(u.pathname);
    });
    if (links.length !== 1) { status(`No unambiguous ${direction}-candidate link. Use Greenhouse navigation.`); return; }
    location.assign(links[0].href);
  }
  document.addEventListener("keydown", e => {
    // Greenhouse has its own unmodified R/M/X/1–5/arrows shortcuts. Cautious Review only owns Alt chords.
    if (!e.isTrusted || !enabled.checked || e.repeat || e.isComposing || !e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented) return;
    const path = e.composedPath();
    if (path.some(node => node instanceof HTMLElement && (node.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON|A)$/.test(node.tagName) || node.getAttribute("role") === "textbox"))) return;
    if ([...document.querySelectorAll<HTMLElement>("[role='dialog'],dialog[open]")].some(el => el.getClientRects().length > 0)) return;
    const key = e.key.toLowerCase();
    if (!/^[amrujk/1-7]$/.test(key)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (key === "/") { $<HTMLInputElement>("#search").focus(); return; }
    if (key === "j" || key === "k") { navigate(key === "j" ? "next" : "previous"); return; }
    if (key === "u") { void run(async () => { const r = await send("undo"); status(r.changed ? "Previous local decision restored." : "Nothing to undo."); }); return; }
    if (/^[1-7]$/.test(key)) { reason.value = reasons[Number(key) - 1]; void run(() => queue("reject")); return; }
    void run(() => queue(key === "a" ? "advance" : key === "m" ? "maybe" : "reject"));
  }, true);
  async function refreshContext() {
    try {
      const context = await send("context"); host.hidden = false;
      status(context.applicationId ? `Application ${context.applicationId}. Local-only preview.` : "Candidate page only: open a specific job application to queue decisions.");
    } catch { host.hidden = !/^\/(?:applications\/review|plans\/[^/]+\/candidates)(?:\/|$)/.test(location.pathname); enabled.checked = false; status("Open Live Review to resolve the application and retrieve its résumé. Ambiguous page identity cannot queue decisions."); }
  }
  // Route polling never scrapes or indexes text. No mutation-observer write loop.
  setInterval(() => {
    if (location.href === currentUrl) return;
    currentUrl = location.href; ++generation; enabled.checked = false; reason.value = "";
    $<HTMLTextAreaElement>("#resume").value = ""; showRecords([]); void refreshContext();
  }, 500);
  void refreshContext();
})();
