import { contextFor, type CandidateDocument } from './core.js';

export const ENGINE_VERSION = 'rules-0.2.0';
export interface Passage { start: number; end: number; quote: string; via: string; kind: 'mention' | 'work_claim' | 'possible_negation' }
export interface CriterionResult { criterion: string; status: 'not_established' | Passage['kind']; passages: Passage[] }
export interface Diagnostic { code: string; count: number; explanation: string }
// Small, inspectable domain dictionary. These are retrieval aliases, NOT equivalent qualifications.
export const ALIASES: Readonly<Record<string, readonly string[]>> = Object.freeze({
  kubernetes: ['kubernetes', 'k8s', 'eks', 'gke', 'aks'], k8s: ['k8s', 'kubernetes', 'eks', 'gke', 'aks'],
  aws: ['aws', 'amazon web services'], javascript: ['javascript', 'ecmascript'],
  postgres: ['postgres', 'postgresql'], postgresql: ['postgresql', 'postgres'],
  'infrastructure as code': ['infrastructure as code', 'iac', 'terraform', 'cloudformation'],
  'incident response': ['incident response', 'incident management', 'postmortem', 'on-call', 'on call'],
  'retrieval augmented generation': ['retrieval augmented generation', 'retrieval-augmented generation', 'rag'],
  rag: ['rag', 'retrieval augmented generation', 'retrieval-augmented generation'],
  'continuous integration': ['continuous integration', 'ci/cd', 'ci-cd'],
});
interface Token { value: string; start: number; end: number }
function spans(text: string): Token[] {
  return [...text.matchAll(/[\p{L}\p{N}]+(?:[+#]+|(?:[.-][\p{L}\p{N}]+)*)/gu)]
    .map(m => ({ value: m[0].toLocaleLowerCase('en-US'), start: m.index!, end: m.index! + m[0].length }));
}
function occurrences(text: string, phrase: string, source = spans(text)): { start: number; end: number }[] {
  const query = spans(phrase).map(t => t.value);
  if (!query.length) return [];
  const result: { start: number; end: number }[] = [];
  for (let i = 0; i <= source.length - query.length; i++) {
    if (query.every((q, j) => source[i + j].value === q)) result.push({ start: source[i].start, end: source[i + query.length - 1].end });
    if (result.length >= 8) break;
  }
  return result;
}
export function parseCriteria(input: string): string[] {
  if (input.length > 8000) throw Error('Limit criteria to 8,000 characters');
  const criteria = [...new Set(input.split(/\r?\n/).map(s => s.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean))];
  if (!criteria.length || criteria.length > 30 || criteria.some(s => s.length > 240)) throw Error('Use 1–30 criteria, one per line, at most 240 characters each');
  return criteria;
}
function alternatives(criterion: string): string[] {
  const literals = criterion.split('|').map(t => t.trim().toLocaleLowerCase('en-US')).filter(Boolean);
  return [...new Set(literals.flatMap(t => ALIASES[t] ?? [t]))];
}
function passageAround(text: string, start: number, end: number): { start: number; end: number; quote: string } {
  // Keep source offsets and original text intact. Do not invent sentence boundaries inside URLs/numbers.
  let a = Math.max(text.lastIndexOf('\n', start), text.lastIndexOf('. ', start), text.lastIndexOf('; ', start)) + 1;
  if (start - a > 350) a = Math.max(a, start - 200);
  const bounds = [text.indexOf('\n', end), text.indexOf('. ', end), text.indexOf('; ', end)].filter(n => n >= 0);
  let b = bounds.length ? Math.min(...bounds) + 1 : text.length;
  b = Math.min(b, end + 350);
  while (a < start && /\s/.test(text[a])) a++;
  return { start: a, end: b, quote: text.slice(a, b) };
}
export function assess(text: string, input: string): CriterionResult[] {
  if (text.length < 10 || text.length > 200000) throw Error('Résumé text must contain 10–200,000 characters');
  const source = spans(text);
  return parseCriteria(input).map(criterion => {
    const passages: Passage[] = [];
    for (const via of alternatives(criterion)) {
      for (const hit of occurrences(text, via, source)) {
        const p = passageAround(text, hit.start, hit.end);
        if (passages.some(existing => existing.start === p.start && existing.end === p.end)) continue;
        const before = text.slice(Math.max(p.start, hit.start - 80), hit.start);
        const negated = /\b(?:no|never|not|without|lack(?:s|ing)?|unfamiliar)\b[^.;\n]{0,60}$/i.test(before);
        // A verb makes this a self-reported work claim, never a verified accomplishment.
        const work = /\b(?:built|designed|implemented|operated|deployed|debugged|migrated|maintained|tested|measured|evaluated|reduced|investigated|owned|scaled|developed|replaced|instrumented)\b/i.test(p.quote);
        passages.push({ ...p, via, kind: negated ? 'possible_negation' : work ? 'work_claim' : 'mention' });
        if (passages.length >= 6) break;
      }
      if (passages.length >= 6) break;
    }
    // Conflicting/negated claims remain visible; never infer a qualification failure from them.
    const status = passages.some(p => p.kind === 'possible_negation') ? 'possible_negation'
      : passages.some(p => p.kind === 'work_claim') ? 'work_claim' : passages.length ? 'mention' : 'not_established';
    return { criterion, status, passages };
  });
}
export function diagnostics(text: string) {
  const lines = text.split(/\r?\n/), words = spans(text), bullets = lines.filter(s => /^\s*(?:[-*•▪◦]|\d+[.)])\s+/.test(s));
  const normalized = lines.map(s => s.trim().toLocaleLowerCase('en-US')).filter(s => spans(s).length >= 6);
  const duplicateLines = normalized.length - new Set(normalized).size;
  const longBullets = bullets.filter(s => spans(s).length > 60).length;
  const hidden = (text.match(/[\u200B-\u200D\u2060\uFEFF]/g) ?? []).length;
  const replacement = (text.match(/\uFFFD/g) ?? []).length;
  const flags: Diagnostic[] = [];
  if (duplicateLines) flags.push({ code: 'duplicate_lines', count: duplicateLines, explanation: 'Repeated lines; may also be PDF extraction duplication. Inspect the original.' });
  if (longBullets) flags.push({ code: 'long_bullets', count: longBullets, explanation: 'Bullets longer than 60 words may be hard to scan. This is a document diagnostic, not a skill finding.' });
  if (bullets.length > 30) flags.push({ code: 'many_bullets', count: bullets.length, explanation: 'More than 30 bullet lines. Length and relevance require human review.' });
  if (hidden) flags.push({ code: 'invisible_characters', count: hidden, explanation: 'Invisible Unicode characters; could be formatting or extraction artifacts.' });
  if (replacement) flags.push({ code: 'extraction_corruption', count: replacement, explanation: 'Replacement characters indicate possible text decoding problems. Do not assess missing skills from corrupted extraction.' });
  return { words: words.length, lines: lines.length, bullets: bullets.length, flags,
    limitations: ['Plain text cannot establish original font sizes, visual density, bolding, or AI authorship.', 'No readability metric changes retrieval ordering or disposition.'] };
}
export function conceptSearch(query: string, documents: CandidateDocument[]) {
  const terms = [...new Set(spans(query).map(t => t.value))].slice(0, 30);
  if (!terms.length) return [];
  return documents.map(document => {
    const source = spans(document.text);
    const matched: string[] = [], evidence: string[] = [];
    for (const term of terms) {
      const via = alternatives(term).find(alias => occurrences(document.text, alias, source).length);
      if (!via) continue;
      matched.push(term);
      if (evidence.length < 4) {
        const at = occurrences(document.text, via, source)[0];
        evidence.push(`${term}${via !== term ? ` (via ${via})` : ''}:\n${passageAround(document.text, at.start, at.end).quote}`);
      }
    }
    return { document, matched, total: terms.length, evidence };
  }).filter(hit => hit.matched.length).sort((a, b) => b.matched.length - a.matched.length || a.document.key.localeCompare(b.document.key)).slice(0, 20);
}
/** Validate the entire import before any storage writes. Never import executable actions. */
export function validateImport(input: unknown, origin: string): CandidateDocument[] {
  if (!Array.isArray(input) || !input.length || input.length > 1000) throw Error('Import an array of 1–1,000 résumé records');
  const keys = new Set<string>(); let total = 0;
  return input.map((r, i) => {
    const c = contextFor(typeof r?.url === 'string' ? r.url : '');
    if (!c || c.origin !== origin) throw Error(`Record ${i + 1}: requires a valid URL on the current Greenhouse origin`);
    if (keys.has(c.key)) throw Error(`Record ${i + 1}: duplicate application/candidate`); keys.add(c.key);
    if (typeof r.text !== 'string' || r.text.trim().length < 10 || r.text.length > 200000) throw Error(`Record ${i + 1}: requires 10–200,000 characters of text`);
    total += r.text.length; if (total > 5000000) throw Error('Import is too large; split into files below 5 million text characters');
    if (['decision', 'action', 'reason'].some(k => Object.hasOwn(r, k))) throw Error('Imports accept résumé records only, never decisions or actions');
    return { ...c, name: typeof r.name === 'string' ? r.name.slice(0, 200) : 'Candidate', text: r.text, indexedAt: new Date().toISOString() };
  });
}
