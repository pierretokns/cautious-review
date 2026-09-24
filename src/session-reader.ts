import { contextFor, HOSTS, type CandidateDocument, type Context } from './core.js';
import { attachmentURL, downloadAttachment } from './harvest.js';
import { extractDocument } from './pdf.js';
import { saveDocument, documents, purgeExpired } from './storage.js';
import { assess, diagnostics } from './evidence.js';
import { clearSemanticCache, hybridSearch } from './semantic.js';

type RuntimeBridge = { sendMessage(message: unknown): Promise<unknown> };
type ReadContext = { context: Context; documentUrl: string };
const byId = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const value = (id: string) => byId<HTMLInputElement | HTMLTextAreaElement>(id).value;
const status = (message: string) => { byId('status').textContent = message; };
let current: CandidateDocument | undefined;
let generation = 0;

function canonicalContext(input: unknown): Context | null {
  if (!input || typeof input !== 'object') return null;
  const c = input as Partial<Context>;
  if (typeof c.origin !== 'string' || typeof c.url !== 'string' || c.url.length > 2048 || typeof c.key !== 'string' ||
      typeof c.candidateId !== 'string' || typeof c.applicationId !== 'string') return null;
  if (!/^[1-9]\d{0,19}$/.test(c.candidateId) || !/^[1-9]\d{0,19}$/.test(c.applicationId)) return null;
  try {
    const origin = new URL(c.origin);
    const url = new URL(c.url);
    if (origin.protocol !== 'https:' || !HOSTS.has(origin.hostname) || origin.port || origin.username || origin.password ||
        url.origin !== origin.origin || url.hash ||
        c.key !== `${origin.origin}|application:${c.applicationId}`) return null;
    // Re-derive identities from the canonical Greenhouse route/query forms
    // already supported by the local context parser; do not trust bridge IDs.
    const checked = contextFor(url.href);
    if (!checked || checked.url !== url.href || checked.origin !== origin.origin ||
        checked.candidateId !== c.candidateId || checked.applicationId !== c.applicationId) return null;
    return { key: c.key, origin: origin.origin, candidateId: c.candidateId, applicationId: c.applicationId, url: url.href };
  } catch { return null; }
}

function readContext(input: unknown): ReadContext | null {
  if (!input || typeof input !== 'object') return null;
  const raw = input as Partial<ReadContext>;
  const context = canonicalContext(raw.context);
  if (!context || typeof raw.documentUrl !== 'string' || raw.documentUrl.length > 16000) return null;
  try {
    const documentUrl = attachmentURL(raw.documentUrl);
    if (documentUrl.length > 16000) return null;
    return { context, documentUrl };
  } catch { return null; }
}

function renderEvidence(results: ReturnType<typeof assess>) {
  const root = byId('evidence');
  const labels: Record<string, string> = {
    work_claim: 'Self-reported work claim', mention: 'Mention only',
    not_established: 'Not established in this text',
    possible_negation: 'Possible negation or conflict — review',
  };
  root.replaceChildren(...results.map(result => {
    const article = document.createElement('article');
    const heading = document.createElement('h3');
    heading.textContent = `${result.criterion}: ${labels[result.status] ?? 'Review evidence'}`;
    article.append(heading);
    for (const passage of result.passages) {
      const excerpt = document.createElement('p');
      excerpt.textContent = `[${passage.start}–${passage.end}] ${passage.quote}`;
      article.append(excerpt);
    }
    return article;
  }));
  const summary = diagnostics(current?.text ?? '');
  const note = document.createElement('p');
  note.textContent = `Document diagnostics: ${summary.words} words, ${summary.bullets} bullet lines. ` +
    (summary.flags.length ? summary.flags.map(flag => flag.explanation).join(' ') : 'No configured text-format flags.');
  root.append(note);
}

function showContext(context: Context) {
  byId('identity').textContent = `Greenhouse page linked candidate ${context.candidateId}, application ${context.applicationId}. ` +
    'These identifiers come from the current page and are not independently verified by Harvest. Job and stage are unknown.';
}

async function loadCurrent() {
  const ticket = ++generation;
  const loadButton = byId<HTMLButtonElement>('load');
  loadButton.disabled = true;
  loadButton.textContent = 'Loading résumé…';
  current = undefined;
  clearSemanticCache();
  byId('analyze').setAttribute('disabled', '');
  byId('search').setAttribute('disabled', '');
  byId('forget').setAttribute('disabled', '');
  byId('resume-text').textContent = '';
  byId('evidence').replaceChildren();
  byId('search-results').replaceChildren();
  const id = new URL(location.href).searchParams.get('id');
  const runtime = (globalThis as typeof globalThis & { chrome?: { runtime?: RuntimeBridge } }).chrome?.runtime;
  if (!id || !/^[A-Za-z0-9_-]{16,128}$/.test(id) || !runtime) {
    status('No valid one-use Greenhouse page handoff is available. Return to the Greenhouse tab and open the résumé again.');
    loadButton.textContent = 'Reopen résumé from Greenhouse to load again';
    return;
  }
  status('Checking the one-use handoff from the current Greenhouse page…');
  try {
    const response = await runtime.sendMessage({ type: 'session-read-context', id }) as { ok?: boolean; value?: unknown } | null;
    if (generation !== ticket) return;
    if (!response?.ok) throw Error();
    const handoff = readContext(response.value);
    if (!handoff) throw Error();
    showContext(handoff.context);
    status('Downloading the page-linked résumé from approved Greenhouse storage; extraction stays on this device…');
    const bytes = await downloadAttachment(handoff.documentUrl);
    if (generation !== ticket) return;
    const extracted = await extractDocument(bytes, 'resume.pdf');
    if (generation !== ticket) return;
    if (extracted.text.trim().length < 10) throw Error();
    current = {
      ...handoff.context,
      name: `Application ${handoff.context.applicationId}`,
      text: extracted.text,
      indexedAt: new Date().toISOString(),
    };
    await purgeExpired();
    await saveDocument(current);
    if (generation !== ticket) return;
    byId('resume-text').textContent = extracted.text;
    byId('analyze').removeAttribute('disabled');
    byId('search').removeAttribute('disabled');
    byId('forget').removeAttribute('disabled');
    status(`Résumé text extracted locally · ${extracted.pages} page(s) · ${extracted.tinyText} text runs below 8pt. No action was sent to Greenhouse.`);
  } catch {
    if (generation !== ticket) return;
    current = undefined;
    status('Could not read the page-linked résumé. Reopen it from the Greenhouse candidate page and try again. No candidate action was sent.');
  } finally {
    loadButton.textContent = 'Reopen résumé from Greenhouse to load again';
    loadButton.disabled = true;
  }
}

byId('load').addEventListener('click', event => { if (event.isTrusted) void loadCurrent(); });
byId('analyze').addEventListener('click', event => {
  if (!event.isTrusted || !current) return;
  try {
    renderEvidence(assess(current.text, value('criteria')));
    status('Source passages shown for human review. No qualification or disposition was inferred.');
  } catch {
    status('Could not analyze this text. Enter 1–30 criteria, one per line, then try again.');
  }
});
byId('search').addEventListener('click', event => {
  if (!event.isTrusted || !current) return;
  const ticket = generation;
  const selectedDocument = current;
  const button = byId<HTMLButtonElement>('search');
  button.disabled = true;
  void (async () => {
    try {
      await purgeExpired();
      const corpus = await documents(selectedDocument.origin);
      if (generation !== ticket || current !== selectedDocument) return;
      if (!corpus.some(doc => doc.key === selectedDocument.key)) corpus.push(selectedDocument);
      status('Loading the local-only search model…');
      const hits = await hybridSearch(value('query'), corpus, progress => {
        if (generation === ticket && current === selectedDocument) status(progress);
      });
      if (generation !== ticket || current !== selectedDocument) {
        clearSemanticCache();
        return;
      }
      const root = byId('search-results');
      root.replaceChildren(...hits.map(hit => {
        const article = document.createElement('article');
        const title = document.createElement('h3');
        title.textContent = hit.document.name;
        const passage = document.createElement('p');
        passage.textContent = `${hit.passage.quote}\nSource characters ${hit.passage.start}–${hit.passage.end}`;
        article.append(title, passage);
        return article;
      }));
      status('Local hybrid retrieval complete. Similarity retrieves passages; it does not score candidate capability or disposition.');
    } catch {
      if (generation === ticket && current === selectedDocument) status('Local search could not run. Confirm the query and bundled model, then try again.');
    } finally {
      if (generation === ticket && current === selectedDocument) button.disabled = false;
      else clearSemanticCache();
    }
  })();
});
byId('forget').addEventListener('click', event => {
  if (!event.isTrusted) return;
  generation++;
  clearSemanticCache();
  current = undefined;
  byId('resume-text').textContent = '';
  byId('evidence').replaceChildren();
  byId('search-results').replaceChildren();
  byId<HTMLTextAreaElement>('criteria').value = '';
  byId('identity').textContent = 'No current résumé loaded.';
  byId('analyze').setAttribute('disabled', '');
  byId('search').setAttribute('disabled', '');
  byId('forget').setAttribute('disabled', '');
  status('The displayed résumé text was cleared from this page. Its local saved copy remains until you clear local data from Live Review.');
});
