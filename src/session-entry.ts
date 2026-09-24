import { sessionReadContext, attachmentPreviewPath, previewDocumentURL } from './session-resume.js';
import { boundedBytes } from './harvest.js';

(() => {
 const ui = document.getElementById('cautious-review')?.shadowRoot;
 if (!ui) return;
 const button = document.createElement('button');
 button.id = 'session-read-resume'; button.textContent = 'Read this résumé locally · no admin key';
 const note = document.createElement('p'); note.id = 'session-read-status'; note.setAttribute('role','status');
 note.textContent = 'Reads the visible résumé link on this Greenhouse page. Check that it is the version relevant to this application. No candidate actions.';
 ui.querySelector('h2')!.after(button, note);
 function selectedLinks(): string[] {
  return [...document.querySelectorAll<HTMLAnchorElement>('nav a[aria-current="page"][href]')]
   .filter(a => a.getClientRects().length && new URL(a.href).origin === location.origin).map(a => a.href);
 }
 function attachmentId(): string {
  const ids = new Set<string>();
  for (const element of document.querySelectorAll<HTMLElement>('a[href],button[data-attachment-id]')) {
   if (!element.getClientRects().length || element.closest('[contenteditable],.resume,[data-testid="resume"],iframe')) continue;
   const label = (element.getAttribute('aria-label') ?? element.textContent ?? '').trim();
   if (!/^(?:view |download |open )?(?:résumé|resume|cv)(?:\s*\([^)]{1,80}\))?$/i.test(label)) continue;
   if (element instanceof HTMLAnchorElement) {
    const url = new URL(element.href, location.href);
    if (url.origin !== location.origin) continue;
    const match = url.pathname.match(/^\/(?:attachments|attachment_previews)\/([1-9]\d*)(?:\/(?:download|preview))?\/?$/);
    if (match) ids.add(match[1]);
   } else if (/^[1-9]\d*$/.test(element.dataset.attachmentId ?? '')) ids.add(element.dataset.attachmentId!);
  }
  if (ids.size !== 1) throw Error('No unique visible résumé attachment link. Open the candidate application and its résumé in Greenhouse first.');
  return [...ids][0];
 }
 button.addEventListener('click', event => {
  if (!event.isTrusted || button.disabled) return;
  button.disabled = true;
  void (async () => {
   try {
    const page = location.href, links = selectedLinks(), context = sessionReadContext(page, links), id = attachmentId();
    note.textContent = 'Reading Greenhouse’s résumé preview using your existing session…';
    const response = await fetch(new URL(attachmentPreviewPath(id),location.origin),{
     method:'GET',credentials:'same-origin',redirect:'error',headers:{Accept:'application/json'},signal:AbortSignal.timeout(20000)
    });
    if (!response.ok) throw Error(`Greenhouse preview returned HTTP ${response.status}. Your session must have permission to view this résumé.`);
    if (!/^application\/json\b/i.test(response.headers.get('content-type') ?? '')) throw Error('Greenhouse returned a sign-in page or an unsupported preview format.');
    const payload = JSON.parse(new TextDecoder().decode(await boundedBytes(response,1_000_000)));
    const documentUrl = previewDocumentURL(payload);
    if (location.href !== page || sessionReadContext(location.href,selectedLinks()).key !== context.key || attachmentId() !== id)
     throw Error('The application or résumé changed while loading. Try again on the intended application.');
    const result = await chrome.runtime.sendMessage({type:'open-session-reader',url:page,selectedLinks:links,documentUrl});
    if (!result?.ok) throw Error(result?.error ?? 'Could not open the local reader.');
    note.textContent = 'Local reader opened. Check the displayed application and résumé before reviewing evidence.';
   } catch (error) {
    // Never print raw fetch/URL/JSON errors that might contain a signed URL or candidate text.
    const message = error instanceof Error ? error.message : '';
    note.textContent = /^(Open one|Page and|No unique|Greenhouse (preview returned|returned)|The application|Could not open)/.test(message)
     ? message : 'Could not read this résumé safely. The private Greenhouse preview interface may differ; use diagnostics or local import.';
   } finally { button.disabled = false; }
  })();
 });
})();
