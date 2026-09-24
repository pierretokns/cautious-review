import {routeIdentity} from './identity.js';
import { contextFor, search, validateDecision } from './core.js';
import { clear, decide, documents, purgeExpired, reviews, saveDocument, saveDocumentsAtomic, auditEntries, undo } from './storage.js';
import { clearReceipts } from './live-store.js';
import { assess, conceptSearch, diagnostics, ENGINE_VERSION, validateImport } from './evidence.js';
let serial: Promise<unknown> = Promise.resolve();
// Content scripts cannot access Harvest credentials or invoke live mutations.
chrome.runtime.onMessage.addListener((message, sender, respond) => {
 if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || !sender.tab) return false;
 if(message?.type === 'open-live') {
  void (async()=>{try { const u=new URL(sender.url??'');
   const facts=Array.isArray(message.facts)?message.facts.filter((v:unknown)=>!!v&&typeof v==='object'&&!Array.isArray(v)):[];
   const hints=routeIdentity(u.href,facts);
   for(const [key,name] of [['applicationId','application_id'],['candidateId','candidate_id'],['jobId','job_id'],['stageId','stage_id']] as const) if(hints[key])u.searchParams.set(name,hints[key]!);
   await chrome.tabs.create({url:chrome.runtime.getURL('live.html')+'?source='+encodeURIComponent(u.href)});respond({ok:true});
  }catch(error){respond({ok:false,error:error instanceof Error?error.message:'Could not open Live Review'});}})();return true;
 }
 const context = contextFor(sender.url ?? ''), requested = contextFor(message?.url ?? '');
 if (!context || !requested || context.key !== requested.key) { respond({ ok: false, error: 'Candidate/application context unavailable or changed' }); return false; }
 serial = serial.catch(() => undefined).then(async () => {
  await purgeExpired();
  switch (message.type) {
   case 'context': return context;
   case 'capture': {
    if (typeof message.text !== 'string' || message.text.trim().length < 10 || message.text.length > 200000) throw Error('Select/paste 10–200,000 characters of résumé text');
    await saveDocument({ ...context, name: String(message.name ?? '').slice(0, 200), text: message.text, indexedAt: new Date().toISOString() }); return { indexed: true };
   }
   case 'queue': {
    if (!context.applicationId) throw Error('Application ID required: open a specific job application before queueing');
    const decision = validateDecision(message.decision, message.reason);
    await decide({ ...context, ...decision, createdAt: new Date().toISOString() }); return { queued: true };
   }
   case 'undo': return { changed: await undo(context) };
   case 'search': return (message.concepts === false ? search : conceptSearch)(String(message.query ?? '').slice(0, 1000), await documents(context.origin));
   case 'list': return reviews(context.origin);
   case 'document': return (await documents(context.origin)).find(d => d.key === context.key) ?? null;
   case 'analyze': {
    const doc = (await documents(context.origin)).find(d => d.key === context.key);
    if (!doc) throw Error('Index résumé text for this application first');
    if (typeof message.criteria !== 'string') throw Error('Provide criteria, one per line');
    const criteria = assess(doc.text, message.criteria);
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(doc.text));
    return { engineVersion: ENGINE_VERSION, application: context, sourceSha256: [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join(''), analyzedAt: new Date().toISOString(), criteria, diagnostics: diagnostics(doc.text) };
   }
   case 'import': { const batch = validateImport(message.records, context.origin); await saveDocumentsAtomic(batch); return { imported: batch.length }; }
   case 'export': return { schemaVersion: 1, extensionVersion: '0.3.1', exportedAt: new Date().toISOString(), origin: context.origin, mode: 'local-review-only', greenhouseWrites: 0, reviews: await reviews(context.origin), audit: await auditEntries(context.origin) };
   case 'clear': await clear(); await clearReceipts(); return { cleared: true };
   default: throw Error('Unsupported message');
  }
 });
 serial.then(value => respond({ ok: true, value }), error => respond({ ok: false, error: error instanceof Error ? error.message : 'Local operation failed' })); return true;
});
