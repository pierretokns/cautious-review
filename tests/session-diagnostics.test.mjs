import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeObservation, validateObservation } from '../dist/session-diagnostics.js';

test('sanitizes URL IDs, values, origin, and credential query keys', () => {
  const result = sanitizeObservation({ method: 'post', url: 'https://harvest.greenhouse.io/v3/applications/987654/reject?application_id=987654&access_token=secret&status=active', status: 204 });
  assert.deepEqual(result, { method: 'POST', pathTemplate: '/v3/applications/:id/reject', queryKeys: ['application_id', 'status'], status: 204, requestSchema: null, responseSchema: null });
  assert.equal(JSON.stringify(result).includes('987654'), false);
  assert.equal(JSON.stringify(result).includes('secret'), false);
  assert.equal(JSON.stringify(result).includes('harvest.greenhouse.io'), false);
});

test('records structural request/response schemas without scalar values or sensitive branches', () => {
  const result = sanitizeObservation({
    method: 'GET', url: 'https://app.greenhouse.io/applications/123?candidate_id=555&email=person@example.test', status: 200,
    requestBody: { application_ids: [123, 456], status: 'active', password: 'p@ss', credentials: { token: 'bearer-secret', id: 999 }, applicant_notes: 'private text' },
    responseBody: [{ id: 123, application_id: 123, status: 'active', prospect: false, candidate: { id: 456, first_name: 'Ada', email_addresses: ['ada@example.test'] }, last_activity_at: '2026-09-24T00:00:00Z' }],
  });
  assert.deepEqual(result?.requestSchema, { types: ['object'], fields: { application_ids: { types: ['array'], items: { types: ['number'] } }, status: { types: ['string'] } } });
  assert.deepEqual(result?.responseSchema, { types: ['array'], items: { types: ['object'], fields: {
    application_id: { types: ['number'] }, candidate: { types: ['object'], fields: { id: { types: ['number'] } } },
    id: { types: ['number'] }, last_activity_at: { types: ['string'] }, prospect: { types: ['boolean'] }, status: { types: ['string'] },
  } } });
  const serialized = JSON.stringify(result);
  for (const secret of ['Ada', 'ada@example.test', 'person@example.test', 'p@ss', 'bearer-secret', '2026-09-24T00:00:00Z', '555']) assert.equal(serialized.includes(secret), false, secret);
});

test('keeps common API containers and resume parse field types without candidate values', () => {
  const result = sanitizeObservation({ method: 'GET', url: 'https://harvest.greenhouse.io/v3/candidates/123', responseBody: {
    candidate: { id: 123, name: 'Ada Lovelace', parsed_resume: { resume_text: 'Worked at Example Corp', education: [{ id: 8 }], employments: [{ job_id: 9 }] } },
  } });
  assert.deepEqual(result?.responseSchema, { types: ['object'], fields: { candidate: { types: ['object'], fields: {
    id: { types: ['number'] }, name: { types: ['string'] }, parsed_resume: { types: ['object'], fields: {
      education: { types: ['array'], items: { types: ['object'], fields: { id: { types: ['number'] } } } },
      employments: { types: ['array'], items: { types: ['object'], fields: { job_id: { types: ['number'] } } } },
      resume_text: { types: ['string'] },
    } },
  } } } });
  const serialized = JSON.stringify(result);
  for (const secret of ['Ada Lovelace', 'Worked at Example Corp', '123', 'Example Corp']) assert.equal(serialized.includes(secret), false, secret);
});

test('unknown path segments are replaced while only structural path words remain', () => {
  const result = sanitizeObservation({ method: 'GET', url: 'https://app.greenhouse.io/plans/private-customer/candidates/Ada.Lovelace?candidate_id=87' });
  assert.deepEqual(result?.pathTemplate, '/plans/:segment/candidates/:segment');
  assert.equal(JSON.stringify(result).includes('private-customer'), false);
  assert.equal(JSON.stringify(result).includes('Ada'), false);
});

test('rejects unsupported host, malformed URL, method, status, and oversized URL', () => {
  for (const input of [
    { method: 'POST', url: 'https://evil.test/applications/1/reject' },
    { method: 'POST', url: 'https://user:secret@app.greenhouse.io/applications/1/reject' },
    { method: 'TRACE', url: 'https://app.greenhouse.io/applications/1/reject' },
    { method: 'POST', url: 'not a url' },
    { method: 'POST', url: 'https://app.greenhouse.io/applications/1', status: 99 },
    { method: 'GET', url: 'https://app.greenhouse.io/' + 'x'.repeat(9000) },
  ]) assert.equal(sanitizeObservation(input), null);
});

test('strict body bounds drop whole schemas while preserving safe endpoint metadata', () => {
  const tooLarge = sanitizeObservation({ method: 'POST', url: 'https://app.greenhouse.io/applications/1', requestBody: { status: 'x'.repeat(100_001) } });
  assert.deepEqual(tooLarge, { method: 'POST', pathTemplate: '/applications/:id', queryKeys: [], requestSchema: null, responseSchema: null });
  let deep = { id: 1 }; for (let i = 0; i < 10; i++) deep = { data: deep };
  assert.equal(sanitizeObservation({ method: 'POST', url: 'https://app.greenhouse.io/applications/1', requestBody: deep })?.requestSchema, null);
  assert.equal(sanitizeObservation({ method: 'POST', url: 'https://app.greenhouse.io/applications/1', responseBody: Array(33).fill({ id: 1 }), status: 200 })?.responseSchema, null);
  assert.equal(sanitizeObservation({ method: 'POST', url: 'https://app.greenhouse.io/applications/1', requestBody: Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`k${i}`, 1])) })?.requestSchema, null);
  const cycle = {}; cycle.self = cycle;
  assert.equal(sanitizeObservation({ method: 'POST', url: 'https://app.greenhouse.io/applications/1', requestBody: cycle })?.requestSchema, null);
});

test('credential branches are omitted, including nested credential values', () => {
  const result = sanitizeObservation({ method: 'POST', url: 'https://app.greenhouse.io/applications/1/reject', requestBody: { id: 1, secret: { token: 'access-token', id: 2 }, authorization: 'Bearer abc' } });
  assert.deepEqual(result?.requestSchema, { types: ['object'], fields: { id: { types: ['number'] } } });
});

test('validateObservation accepts and canonicalizes only sanitized observations', () => {
  const clean = sanitizeObservation({ method: 'get', url: 'https://harvest.greenhouse.io/v3/applications?ids=999', responseBody: [{ id: 999, status: 'active' }] });
  assert.deepEqual(validateObservation(clean), clean);
  assert.equal(validateObservation({ ...clean, candidateName: 'Ada' }), null);
  assert.equal(validateObservation({ ...clean, queryKeys: ['ids', 'access_token'] }), null);
  assert.equal(validateObservation({ ...clean, pathTemplate: '/v3/applications/999' }), null);
  assert.equal(validateObservation({ ...clean, responseSchema: { types: ['object'], fields: { password: { types: ['string'] } } } }), null);
  assert.equal(validateObservation({ ...clean, responseSchema: { types: ['candidate-pii'] } }), null);
  assert.equal(validateObservation({ ...clean, responseSchema: { types: ['object'], fields: { unknown_pii: { types: ['string'] } } } }), null);
  const nestedText = { ...clean, responseSchema: { types: ['object'], fields: { text: { types: ['string'], fields: { content: { types: ['string'] } } } } } };
  assert.equal(validateObservation(nestedText), null);
});

test('accessor-backed raw input is rejected without invoking getters', () => {
  let called = false;
  const value = { method: 'GET', url: 'https://app.greenhouse.io/applications/1' };
  Object.defineProperty(value, 'responseBody', { enumerable: true, get() { called = true; return { id: 1 }; } });
  assert.equal(sanitizeObservation(value), null);
  assert.equal(called, false);
});
