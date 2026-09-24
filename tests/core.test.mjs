import test from 'node:test';
import assert from 'node:assert/strict';
import { contextFor, search, validateDecision, tokens, REASONS } from '../dist/core.js';
const app = 'https://app.greenhouse.io';
for (const path of ['/people/10?job_application_id=20','/candidates/10?application_id=20','/applications/20']) {
  test(`Recognizes ${path}`, () => assert.equal(contextFor(app+path)?.applicationId, '20'));
}
for (const host of ['app.greenhouse.io','app2.greenhouse.io','app3.greenhouse.io','app4.greenhouse.io','app5.greenhouse.io','app.eu.greenhouse.io']) {
  test(`Recognizes documented Recruiting host ${host}`, () => assert.equal(contextFor(`https://${host}/applications/20`)?.applicationId, '20'));
}
for (const host of ['app6.greenhouse.io','boards.greenhouse.io','api.greenhouse.io','harvest.greenhouse.io','onboarding.greenhouse.io']) {
  test(`Refuses unconfigured Greenhouse host ${host}`, () => assert.equal(contextFor(`https://${host}/applications/20`), null));
}
for (const url of ['https://boards.greenhouse.io/people/10', 'https://app.greenhouse.io.evil.test/people/10', 'http://app.greenhouse.io/people/10', app+'/jobs/10', app+'/people/new', app+'/people/10?application_id=20&job_application_id=21', app+'/people/10?application_id=nope', app+'/applications/20?application_id=21', 'not a URL']) {
  test(`Refuses unsupported or ambiguous context ${url}`, () => assert.equal(contextFor(url), null));
}
test('Same candidate in different jobs has different application keys', () => assert.notEqual(contextFor(app+'/people/10?application_id=20').key, contextFor(app+'/people/10?application_id=21').key));
test('Candidate-only context does not invent an application', () => assert.equal(contextFor(app+'/people/10').applicationId, undefined));
test('Canonical URL discards unrelated query values', () => assert.equal(contextFor(app+'/people/10?job_application_id=20&token=PRIVATE').url, app+'/people/10?job_application_id=20'));
test('Reject needs explicit supported reason', () => assert.throws(() => validateDecision('reject', '')));
test('No unknown disposition', () => assert.throws(() => validateDecision('hired', '')));
test('Valid rejection preserved', () => assert.equal(validateDecision('reject', REASONS[0]).reason, REASONS[0]));
const doc = text => ({ ...contextFor(app+'/applications/20'), name:'Synthetic Candidate', text, indexedAt:new Date().toISOString() });
test('Java does not match JavaScript', () => assert.equal(search('Java',[doc('JavaScript projects')]).length,0));
test('Keyword repetition does not improve retrieval score', () => assert.equal(search('Kubernetes AWS',[doc('Kubernetes '.repeat(200))])[0].matched.length,1));
test('Preserves source evidence', () => assert.match(search('AWS',[doc('Operated AWS services.')])[0].evidence[0], /Operated AWS/));
test('Supports Unicode text and C++', () => { assert.ok(tokens('équipe C++').includes('équipe'));assert.ok(tokens('équipe C++').includes('c++')); });
test('Empty query returns no results', () => assert.deepEqual(search(' ',[doc('AWS')]),[]));
