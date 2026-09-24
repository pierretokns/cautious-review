import { contextFor, type Context } from './core.js';
import { attachmentURL } from './harvest.js';
import { routeIdentity } from './identity.js';

/** Independent implementation of URL facts documented in BROWSER-SESSION-RESEARCH.md. */
export function sessionReadContext(page: string, selectedLinks: string[] = []): Context {
 const hints = routeIdentity(page);
 const base = contextFor(page), origin = new URL(page).origin;
 const candidates = [base, ...selectedLinks.map(link => contextFor(link))]
  .filter((c): c is Context => !!c && c.origin === origin && !!c.applicationId && !!c.candidateId);
 const keys = new Set(candidates.map(c => `${c.applicationId}|${c.candidateId}`));
 if (keys.size !== 1) throw Error('Open one specific candidate application before reading its résumé.');
 const found = candidates[0];
 if (hints.candidateId && hints.candidateId !== found.candidateId || hints.applicationId && hints.applicationId !== found.applicationId)
  throw Error('Page and selected application identity disagree.');
 if (base?.candidateId && base.candidateId !== found.candidateId || base?.applicationId && base.applicationId !== found.applicationId)
  throw Error('Page and selected application identity disagree.');
 return {...found,url:`${found.origin}/people/${found.candidateId}/applications/${found.applicationId}`};
}

export function attachmentPreviewPath(id: string): string {
 if (!/^[1-9]\d{0,19}$/.test(id)) throw Error('Invalid résumé attachment identity.');
 return `/attachment_previews/${id}?width=800`;
}

export function previewDocumentURL(payload: unknown): string {
 if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw Error('Unrecognized Greenhouse résumé preview response.');
 const source = (payload as Record<string, unknown>).source;
 if (typeof source !== 'string' || source.length > 16000) throw Error('Greenhouse preview has no usable document URL.');
 let viewer: URL;
 try { viewer = new URL(source); } catch { throw Error('Invalid Greenhouse preview URL.'); }
 if (viewer.protocol !== 'https:' || viewer.username || viewer.password || viewer.port) throw Error('Invalid Greenhouse preview URL.');
 const nested = viewer.searchParams.getAll('document_url');
 if (nested.length > 1) throw Error('Ambiguous Greenhouse document URL.');
 // The wrapper is never fetched. Only the approved Greenhouse storage target is.
 return attachmentURL(nested.length ? nested[0] : source);
}
