import {routeIdentity} from './identity.js';
import { contextFor, search, validateDecision } from './core.js';
import { clear, decide, documents, purgeExpired, reviews, saveDocument, saveDocumentsAtomic, auditEntries, undo } from './storage.js';
import { clearReceipts } from './live-store.js';
import { assess, conceptSearch, diagnostics, ENGINE_VERSION, validateImport } from './evidence.js';
import { sessionReadContext } from './session-resume.js';
import { attachmentURL } from './harvest.js';
let serial: Promise<unknown> = Promise.resolve();
const readerHandoffs = new Map<string, {expires:number;context:ReturnType<typeof sessionReadContext>;documentUrl:string}>();
// Content scripts cannot access Harvest credentials or invoke live mutations.
async function currentTabURL(sender: MessageSender): Promise<string> {
 const tabId = sender.tab?.id;
 if (typeof tabId !== 'number' || !sender.url) throw Error('Current Greenhouse tab unavailable');
 const tab = await chrome.tabs.get(tabId);
 if (typeof tab.url !== 'string') throw Error('Current Greenhouse tab URL unavailable');
 const document = new URL(sender.url), current = new URL(tab.url);
 // A content script can survive same-origin Greenhouse history navigation,
 // while its sender URL still names the original document route.
 if (document.origin !== current.origin) throw Error('Greenhouse page changed');
 return current.href;
}
chrome.runtime.onMessage.addListener((message, sender, respond) => {
 if (message?.type === 'session-read-context') {
  if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || !sender.url?.startsWith(chrome.runtime.getURL('session-reader.html')+'?')) return false;
  if (new URL(sender.url).searchParams.get('id') !== message.id) {respond({ok:false,error:'Invalid reader handoff'});return false;}
  const id = String(message.id ?? ''), saved = readerHandoffs.get(id); readerHandoffs.delete(id);
  if (!saved || saved.expires < Date.now()) {respond({ok:false,error:'Reader handoff expired. Open the résumé again from Greenhouse.'});return false;}
  respond({ok:true,value:{context:saved.context,documentUrl:saved.documentUrl}});return false;
 }
 if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || !sender.tab) return false;
 if (message?.type === 'open-session-reader') {
  void (async()=>{try {
   const pageURL = await currentTabURL(sender);
   if (message.url !== pageURL) throw Error('Page changed');
   const links = Array.isArray(message.selectedLinks) && message.selectedLinks.length <= 20 ? message.selectedLinks.filter((v:unknown)=>typeof v==='string') : [];
   const context = sessionReadContext(pageURL, links);
   const rawDocumentURL = String(message.documentUrl ?? '');
   if (rawDocumentURL.length > 16000) throw Error('Document URL too long');
   const documentUrl = attachmentURL(rawDocumentURL);
   for (const [id,item] of readerHandoffs) if(item.expires < Date.now()) readerHandoffs.delete(id);
   if(readerHandoffs.size >= 10) throw Error('Too many reader windows');
   const id = crypto.randomUUID(); readerHandoffs.set(id,{expires:Date.now()+90000,context,documentUrl});
   setTimeout(()=>readerHandoffs.delete(id),90000);
   try { await chrome.tabs.create({url:chrome.runtime.getURL('session-reader.html')+'?id='+id}); }
   catch(error) {readerHandoffs.delete(id);throw error;}
   respond({ok:true});
  }catch {respond({ok:false,error:'Could not open local reader: application identity or attachment is unavailable.'});}})();return true;
 }
 if(message?.type === 'open-live') {
  void (async()=>{try {
   const pageURL = await currentTabURL(sender);
   if (message.url !== pageURL) throw Error('Page changed');
   const u=new URL(pageURL);
   const facts=Array.isArray(message.facts)?message.facts.filter((v:unknown)=>!!v&&typeof v==='object'&&!Array.isArray(v)):[];
   const hints=routeIdentity(u.href,facts);
   for(const [key,name] of [['applicationId','application_id'],['candidateId','candidate_id'],['jobId','job_id'],['stageId','stage_id']] as const) if(hints[key])u.searchParams.set(name,hints[key]!);
   await chrome.tabs.create({url:chrome.runtime.getURL('live.html')+'?source='+encodeURIComponent(u.href)});respond({ok:true});
  }catch(error){respond({ok:false,error:error instanceof Error?error.message:'Could not open Live Review'});}})();return true;
 }
 void (async()=>{
  const pageURL = await currentTabURL(sender).catch(()=>null);
  const context = pageURL && contextFor(pageURL), requested = contextFor(message?.url ?? '');
  if (!pageURL || pageURL !== message?.url || !context || !requested || context.key !== requested.key) {
   respond({ ok: false, error: 'Candidate/application context unavailable or changed' }); return;
  }
  serial = serial.catch(() => undefined).then(async () => {
   const latestURL = await currentTabURL(sender);
   if (latestURL !== pageURL) throw Error('Candidate/application context changed while queued');
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
   case 'export': return { schemaVersion: 1, extensionVersion: '0.3.3', exportedAt: new Date().toISOString(), origin: context.origin, mode: 'local-review-only', greenhouseWrites: 0, reviews: await reviews(context.origin), audit: await auditEntries(context.origin) };
   case 'clear': readerHandoffs.clear(); await clear(); await clearReceipts(); return { cleared: true };
   default: throw Error('Unsupported message');
   }
  });
  serial.then(value => respond({ ok: true, value }), error => respond({ ok: false, error: error instanceof Error ? error.message : 'Local operation failed' }));
 })(); return true;
});
