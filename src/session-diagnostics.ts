/** Privacy-first schema summaries for user-authorized Greenhouse session diagnostics.
 * This module never retains scalar request/response values, headers, or origins.
 */
const HOSTS = new Set([
  'app.greenhouse.io', 'app2.greenhouse.io', 'app3.greenhouse.io', 'app4.greenhouse.io',
  'app5.greenhouse.io', 'app.eu.greenhouse.io', 'harvest.greenhouse.io', 'api.greenhouse.io',
]);
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
const TYPES = new Set(['null', 'boolean', 'number', 'string', 'array', 'object']);
const STRUCTURAL_SEGMENTS = new Set([
  'api', 'v1', 'v2', 'v3', 'applications', 'application', 'application_stages',
  'candidates', 'candidate', 'people', 'person', 'review', 'plans', 'jobs', 'job',
  'users', 'stages', 'job_interview_stages', 'attachments', 'attachment', 'resumes',
  'documents', 'rejection_reasons', 'rejection_details', 'reject', 'advance', 'move',
  'unreject', 'current', 'active', 'search', 'filters', 'batch', 'new',
]);
// Only common structural API fields are exposed. Unknown and sensitive branches are dropped.
const SAFE_KEYS = new Set([
  'id', 'ids', 'application_id', 'application_ids', 'candidate_id', 'candidate_ids',
  'job_id', 'job_ids', 'stage_id', 'stage_ids', 'application_stage_id',
  'job_interview_stage_id', 'from_stage_id', 'to_stage_id', 'rejection_reason_id',
  'rejection_detail_id', 'rejected_by_id', 'status', 'prospect', 'current', 'active',
  'deactivated', 'sort_order', 'created_at', 'updated_at', 'last_activity_at',
  'rejected_at', 'entered_at', 'exited_at', 'applied_at', 'type', 'per_page', 'page',
  'limit', 'offset', 'cursor', 'total', 'has_more', 'data', 'links', 'meta', 'next',
  'previous', 'results', 'count', 'method', 'action', 'from', 'to', 'source',
  'application', 'applications', 'candidate', 'candidates', 'job', 'jobs', 'stage',
  'stages', 'user', 'users', 'attachment', 'attachments', 'resume', 'resumes',
  'parsed_resume', 'education', 'employments', 'employment', 'experience', 'experiences',
  'resume_text', 'parsed_text', 'text', 'content', 'name', 'filename', 'url', 'download_url',
]);
const SAFE_QUERY_KEYS = new Set([
  'id', 'ids', 'application_id', 'application_ids', 'job_application_id',
  'candidate_id', 'candidate_ids', 'person_id', 'job_id', 'job_ids', 'stage_id',
  'stage_ids', 'from_stage_id', 'to_stage_id', 'rejection_reason_id', 'status',
  'prospect', 'current', 'active', 'type', 'per_page', 'page', 'limit', 'offset',
  'cursor',
]);
const LIMITS = { urlChars: 8192, pathSegments: 32, queryKeys: 64, bodyChars: 100_000, depth: 8, keys: 200, array: 32, nodes: 1200 } as const;
const DROP_KEY = /(?:password|secret|token|cookie|authorization|auth|session)/i;
const TYPE_ONLY_KEYS = new Set(['resume_text', 'parsed_text', 'text', 'content', 'name', 'filename', 'url', 'download_url']);
export type JsonKind = 'null' | 'boolean' | 'number' | 'string' | 'array' | 'object';
export interface JsonShape { types: JsonKind[]; fields?: Record<string, JsonShape>; items?: JsonShape }
export interface Observation {
  method: string;
  pathTemplate: string;
  queryKeys: string[];
  status?: number;
  requestSchema: JsonShape | null;
  responseSchema: JsonShape | null;
}
export interface RawObservation { method: string; url: string; status?: number; requestBody?: unknown; responseBody?: unknown }
type Budget = { chars: number; keys: number; nodes: number; stack: Set<object> };
const isRecord = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};
function ownDataEntries(value: Record<string, unknown>): [string, unknown][] | null {
  const keys = Object.keys(value);
  const entries: [string, unknown][] = [];
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !('value' in descriptor)) return null;
    entries.push([key, descriptor.value]);
  }
  return entries;
}
function canonicalMethod(method: unknown): string | null {
  if (typeof method !== 'string' || method.length > 10) return null;
  const value = method.toUpperCase(); return METHODS.has(value) ? value : null;
}
function pathTemplate(url: URL): string | null {
  const rawSegments = url.pathname.split('/').filter(Boolean);
  if (rawSegments.length > LIMITS.pathSegments) return null;
  const segments = rawSegments.map(raw => {
    let decoded: string;
    try { decoded = decodeURIComponent(raw); } catch { return ':segment'; }
    const lower = decoded.toLowerCase();
    if (STRUCTURAL_SEGMENTS.has(lower)) return lower;
    if (/^[1-9]\d*$/.test(decoded) || /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(decoded)) return ':id';
    return ':segment';
  });
  return '/' + segments.join('/');
}
function parseURL(value: unknown): { pathTemplate: string; queryKeys: string[] } | null {
  if (typeof value !== 'string' || !value || value.length > LIMITS.urlChars) return null;
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || !HOSTS.has(url.hostname.toLowerCase()) || url.port || url.username || url.password) return null;
  const path = pathTemplate(url); if (path === null) return null;
  const allKeys = [...url.searchParams.keys()];
  if (allKeys.length > LIMITS.queryKeys) return null;
  const queryKeys = [...new Set(allKeys.map(k => k.toLowerCase()).filter(k => SAFE_QUERY_KEYS.has(k) && !DROP_KEY.test(k)))].sort();
  return { pathTemplate: path, queryKeys };
}
function kind(value: unknown): JsonKind | null {
  if (value === null) return 'null';
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return Number.isFinite(value) ? 'number' : null;
  if (typeof value === 'string') return 'string';
  if (Array.isArray(value)) return Object.getPrototypeOf(value) === Array.prototype ? 'array' : null;
  if (isRecord(value)) return 'object';
  return null;
}
function merge(a: JsonShape | undefined, b: JsonShape): JsonShape {
  if (!a) return b;
  const types = [...new Set([...a.types, ...b.types])].sort() as JsonKind[];
  const fieldKeys = [...new Set([...Object.keys(a.fields ?? {}), ...Object.keys(b.fields ?? {})])].sort();
  const fields: Record<string, JsonShape> = {};
  for (const key of fieldKeys) fields[key] = merge(a.fields?.[key], b.fields?.[key] ?? a.fields![key]);
  const items = a.items && b.items ? merge(a.items, b.items) : a.items ?? b.items;
  return { types, ...(fieldKeys.length ? { fields } : {}), ...(items ? { items } : {}) };
}
function shape(value: unknown, budget: Budget, depth = 0): JsonShape | null {
  budget.nodes++; if (budget.nodes > LIMITS.nodes || depth > LIMITS.depth) return null;
  const t = kind(value); if (!t) return null;
  if (typeof value === 'string') { budget.chars += value.length; if (budget.chars > LIMITS.bodyChars) return null; }
  if (t === 'object') {
    if (budget.stack.has(value as object)) return null;
    const entries = ownDataEntries(value as Record<string, unknown>); if (!entries) return null;
    budget.stack.add(value as object);
    const fields: Record<string, JsonShape> = {};
    for (const [rawKey, child] of entries) {
      budget.keys++; budget.chars += rawKey.length;
      if (budget.keys > LIMITS.keys || budget.chars > LIMITS.bodyChars) return null;
      const key = rawKey.toLowerCase();
      if (DROP_KEY.test(key)) {
        // Validate limits without retaining any shape from the sensitive subtree.
        if (shape(child, budget, depth + 1) === null) return null;
        continue;
      }
      const childShape = shape(child, budget, depth + 1); if (!childShape) return null;
      if (SAFE_KEYS.has(key)) {
        const exposed = TYPE_ONLY_KEYS.has(key) ? { types: childShape.types } : childShape;
        fields[key] = merge(fields[key], exposed);
      }
    }
    budget.stack.delete(value as object);
    return { types: ['object'], ...(Object.keys(fields).length ? { fields: Object.fromEntries(Object.entries(fields).sort(([a], [b]) => a.localeCompare(b))) } : {}) };
  }
  if (t === 'array') {
    const values = value as unknown[]; if (values.length > LIMITS.array || budget.stack.has(values)) return null;
    budget.stack.add(values);
    let items: JsonShape | undefined;
    for (let i = 0; i < values.length; i++) {
      const descriptor = Object.getOwnPropertyDescriptor(values, String(i));
      if (!descriptor || !('value' in descriptor)) return null;
      const item = shape(descriptor.value, budget, depth + 1); if (!item) return null; items = merge(items, item);
    }
    budget.stack.delete(values);
    return { types: ['array'], ...(items ? { items } : {}) };
  }
  return { types: [t] };
}
function bodySchema(value: unknown, present: boolean): JsonShape | null {
  if (!present) return null;
  return shape(value, { chars: 0, keys: 0, nodes: 0, stack: new Set() });
}
function isJsonKind(value: unknown): value is JsonKind { return typeof value === 'string' && TYPES.has(value); }
function validateShape(value: unknown, depth = 0, budget = { keys: 0, nodes: 0 }): JsonShape | null {
  if (!isRecord(value) || depth > LIMITS.depth || ++budget.nodes > LIMITS.nodes) return null;
  const entries = ownDataEntries(value); if (!entries) return null;
  const allowedFields = new Set(['types', 'fields', 'items']);
  if (entries.some(([k]) => !allowedFields.has(k))) return null;
  if (!Array.isArray(value.types) || !value.types.length || value.types.length > TYPES.size || !value.types.every(isJsonKind)) return null;
  const types = [...new Set(value.types as JsonKind[])].sort(); if (types.length !== value.types.length) return null;
  let fields: Record<string, JsonShape> | undefined;
  if (value.fields !== undefined) {
    if (!isRecord(value.fields)) return null;
    const fieldEntries = ownDataEntries(value.fields); if (!fieldEntries) return null;
    fields = {};
    for (const [rawKey, child] of fieldEntries) {
      const key = rawKey.toLowerCase(); budget.keys++;
      if (budget.keys > LIMITS.keys || !SAFE_KEYS.has(key) || DROP_KEY.test(key)) return null;
      const nested = validateShape(child, depth + 1, budget); if (!nested) return null;
      if (TYPE_ONLY_KEYS.has(key) && (nested.fields || nested.items)) return null;
      fields[key] = nested;
    }
    fields = Object.fromEntries(Object.entries(fields).sort(([a], [b]) => a.localeCompare(b)));
  }
  let items: JsonShape | undefined;
  if (value.items !== undefined) { items = validateShape(value.items, depth + 1, budget) ?? undefined; if (!items) return null; }
  if (fields && !types.includes('object') || items && !types.includes('array')) return null;
  return { types, ...(fields && Object.keys(fields).length ? { fields } : {}), ...(items ? { items } : {}) };
}
/** Build a value-free diagnostic from bounded JSON and a Greenhouse URL. */
export function sanitizeObservation(input: unknown): Observation | null {
  try {
    if (!isRecord(input)) return null;
    const entries = ownDataEntries(input); if (!entries) return null;
    const raw = Object.fromEntries(entries);
    const method = canonicalMethod(raw.method), url = parseURL(raw.url); if (!method || !url) return null;
    const status = raw.status;
    if (status !== undefined && (!Number.isInteger(status) || Number(status) < 100 || Number(status) > 599)) return null;
    const hasReq = Object.hasOwn(raw, 'requestBody') && raw.requestBody !== undefined;
    const hasRes = Object.hasOwn(raw, 'responseBody') && raw.responseBody !== undefined;
    const req = bodySchema(raw.requestBody, hasReq);
    const res = bodySchema(raw.responseBody, hasRes);
    // Unsupported or oversized bodies lose their schema without discarding
    // the still-useful endpoint metadata.
    return { method, pathTemplate: url.pathTemplate, queryKeys: url.queryKeys, ...(status === undefined ? {} : { status: Number(status) }), requestSchema: req, responseSchema: res };
  } catch { return null; }
}
/** Revalidate bridge/UI data before display or export; unexpected keys/values are rejected. */
export function validateObservation(input: unknown): Observation | null {
  try {
    if (!isRecord(input)) return null;
    const entries = ownDataEntries(input); if (!entries) return null;
    const raw = Object.fromEntries(entries);
    const allowed = new Set(['method', 'pathTemplate', 'queryKeys', 'status', 'requestSchema', 'responseSchema']);
    if (entries.some(([key]) => !allowed.has(key))) return null;
    const method = canonicalMethod(raw.method);
    if (!method || method !== raw.method || typeof raw.pathTemplate !== 'string' || raw.pathTemplate.length > LIMITS.urlChars || !raw.pathTemplate.startsWith('/') || raw.pathTemplate.includes('?') || raw.pathTemplate.includes('#') || raw.pathTemplate.includes('\\') || raw.pathTemplate.includes('%')) return null;
    const segments = raw.pathTemplate.split('/').filter(Boolean);
    if (segments.length > LIMITS.pathSegments || raw.pathTemplate !== '/' + segments.join('/') || segments.some(s => !STRUCTURAL_SEGMENTS.has(s) && ![':id', ':segment'].includes(s))) return null;
    if (!Array.isArray(raw.queryKeys) || Object.getPrototypeOf(raw.queryKeys) !== Array.prototype || raw.queryKeys.length > LIMITS.queryKeys) return null;
    const queryValues: unknown[] = [];
    for (let i = 0; i < raw.queryKeys.length; i++) { const d = Object.getOwnPropertyDescriptor(raw.queryKeys, String(i)); if (!d || !('value' in d)) return null; queryValues.push(d.value); }
    if (!queryValues.every(k => typeof k === 'string' && SAFE_QUERY_KEYS.has(k) && !DROP_KEY.test(k)) || new Set(queryValues).size !== queryValues.length) return null;
    const queryKeys = [...queryValues] as string[]; queryKeys.sort();
    const status = raw.status;
    if (status !== undefined && (!Number.isInteger(status) || Number(status) < 100 || Number(status) > 599)) return null;
    if (!Object.hasOwn(raw, 'requestSchema') || !Object.hasOwn(raw, 'responseSchema')) return null;
    const validateBody = (value: unknown): JsonShape | null | undefined => value === null ? null : validateShape(value);
    const requestSchema = validateBody(raw.requestSchema), responseSchema = validateBody(raw.responseSchema);
    if (requestSchema === undefined || responseSchema === undefined || raw.requestSchema !== null && !requestSchema || raw.responseSchema !== null && !responseSchema) return null;
    return { method, pathTemplate: raw.pathTemplate, queryKeys, ...(status === undefined ? {} : { status: Number(status) }), requestSchema, responseSchema };
  } catch { return null; }
}
