export const HOSTS = new Set(["app.greenhouse.io", "app2.greenhouse.io", "app3.greenhouse.io", "app4.greenhouse.io", "app5.greenhouse.io", "app.eu.greenhouse.io"]);
export type Decision = "advance" | "maybe" | "reject";
export interface Context { key: string; origin: string; candidateId?: string; applicationId?: string; url: string }
export interface CandidateDocument extends Context { name: string; text: string; indexedAt: string }
export interface ReviewRecord extends Context { decision: Decision; reason?: string; createdAt: string }

/** Geographic biography is intentionally NOT used to infer authorization or fit. */
export function contextFor(value: string): Context | null {
  let u: URL;
  try { u = new URL(value); } catch { return null; }
  if (u.protocol !== "https:" || !HOSTS.has(u.hostname) || u.port || u.username || u.password) return null;
  const match = u.pathname.match(/^\/(people|candidates|applications)\/([1-9]\d*)(?:\/|$)/);
  if (!match) return null;
  const ids = ["job_application_id", "application_id"].flatMap(k => u.searchParams.getAll(k));
  if (ids.some(v => !/^[1-9]\d*$/.test(v)) || new Set(ids).size > 1) return null;
  const candidateId = match[1] === "applications" ? undefined : match[2];
  const applicationId = match[1] === "applications" ? match[2] : ids[0];
  if (match[1] === "applications" && ids.length && ids[0] !== applicationId) return null;
  const key = `${u.origin}|${applicationId ? `application:${applicationId}` : `candidate:${candidateId}`}`;
  const url = new URL(`/${match[1]}/${match[2]}`, u.origin);
  if (candidateId && applicationId) url.searchParams.set("job_application_id", applicationId);
  return { key, origin: u.origin, candidateId, applicationId, url: url.href };
}

export const REASONS = [
  "Required skills not demonstrated", "Relevant work not demonstrated", "Role scope mismatch",
  "Seniority mismatch", "Explicit on-site answer mismatch", "Explicit sponsorship answer mismatch", "Other — reviewer reason"
];
export function validateDecision(decision: unknown, reason: unknown): { decision: Decision; reason?: string } {
  if (!["advance", "maybe", "reject"].includes(String(decision))) throw Error("Unknown decision");
  if (decision === "reject" && (typeof reason !== "string" || !REASONS.includes(reason))) throw Error("Choose a rejection reason");
  return { decision: decision as Decision, ...(decision === "reject" ? { reason: String(reason) } : {}) };
}
export function tokens(text: string): string[] {
  return (text.toLocaleLowerCase("en-US").match(/[\p{L}\p{N}]+(?:[+#]+|(?:[.-][\p{L}\p{N}]+)*)/gu) ?? [])
    .filter(t => t.length > 1 && !new Set(["the", "and", "with", "for", "from", "that", "this"]).has(t));
}
/** Saturated exact-token retrieval: repetition cannot inflate the score. Not a fit score. */
export function search(query: string, documents: CandidateDocument[]) {
  const terms = [...new Set(tokens(query))];
  if (!terms.length) return [];
  return documents.map(document => {
    const available = new Set(tokens(document.text));
    const matched = terms.filter(term => available.has(term));
    const lower = document.text.toLocaleLowerCase("en-US");
    const evidence = matched.slice(0, 4).map(term => {
      const at = lower.indexOf(term);
      return document.text.slice(Math.max(0, at - 60), Math.min(document.text.length, at + term.length + 140));
    });
    return { document, matched, total: terms.length, evidence };
  }).filter(hit => hit.matched.length).sort((a, b) => b.matched.length - a.matched.length || a.document.key.localeCompare(b.document.key)).slice(0, 20);
}
