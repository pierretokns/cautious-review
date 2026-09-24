import test from 'node:test';
import assert from 'node:assert/strict';
import { routeIdentity, resolveIdentity } from '../dist/identity.js';

const origin = 'https://app.greenhouse.io';

test('direct record routes use only the matching path identity', () => {
  assert.deepEqual(routeIdentity(`${origin}/people/21/profile`), { origin, candidateId: '21' });
  assert.deepEqual(routeIdentity(`${origin}/candidates/21`), { origin, candidateId: '21' });
  assert.deepEqual(routeIdentity(`${origin}/applications/11`), { origin, applicationId: '11' });
});

test('person application routes extract exactly their two explicit path IDs', () => {
  for (const suffix of ['', '/redesign']) {
    assert.deepEqual(
      routeIdentity(`${origin}/people/21/applications/11${suffix}`),
      { origin, candidateId: '21', applicationId: '11' },
    );
  }
});

test('person application routes reject query IDs that disagree with their path', () => {
  for (const query of ['candidate_id=22', 'person_id=22', 'application_id=12', 'job_application_id=12']) {
    assert.throws(() => routeIdentity(`${origin}/people/21/applications/11?${query}`), /Ambiguous/);
  }
});

test('malformed person/application paths are not treated as candidate-only routes', () => {
  for (const path of ['/people/21/applications', '/people/21/applications/not-an-id', '/people/21/applications/11/other']) {
    assert.throws(() => routeIdentity(origin + path), /Unsupported/);
  }
});

test('person application route IDs do not imply job or stage identity', () => {
  assert.deepEqual(routeIdentity(`${origin}/people/21/applications/11/redesign`), {
    origin, candidateId: '21', applicationId: '11',
  });
});

test('review route suffix numbers are not guessed as application or candidate IDs', () => {
  assert.deepEqual(routeIdentity(`${origin}/applications/review/999`), { origin });
  assert.deepEqual(routeIdentity(`${origin}/plans/777/candidates/888`), { origin });
});

test('review and plan candidate routes accept explicit route query identity', () => {
  for (const path of ['/applications/review/999', '/plans/777/candidates']) {
    assert.deepEqual(
      routeIdentity(`${origin}${path}?application_id=11&candidate_id=21&job_id=31&stage_id=41`),
      { origin, applicationId: '11', candidateId: '21', jobId: '31', stageId: '41' },
    );
  }
});

test('Greenhouse-owned page facts can identify a selected application', () => {
  assert.deepEqual(routeIdentity(`${origin}/applications/review/999`, [
    { applicationId: '11' }, { candidateId: '21' }, { jobId: '31' }, { stageId: '41' },
  ]), { origin, applicationId: '11', candidateId: '21', jobId: '31', stageId: '41' });
});

test('conflicting aliases, route values, or owned facts fail closed', () => {
  assert.throws(() => routeIdentity(`${origin}/applications/11?application_id=12`), /Ambiguous/);
  assert.throws(() => routeIdentity(`${origin}/applications/review/999?application_id=11&job_application_id=12`), /Ambiguous/);
  assert.throws(() => routeIdentity(`${origin}/applications/review/999`, [{ applicationId: '11' }, { applicationId: '12' }]), /Ambiguous/);
  assert.throws(() => routeIdentity(`${origin}/people/21?candidate_id=22`), /Ambiguous/);
});

test('unsupported route families and unsafe IDs are rejected', () => {
  for (const path of ['/jobs/31?application_id=11', '/people/new?candidate_id=21', '/applications/not-review/11?application_id=11']) {
    assert.throws(() => routeIdentity(origin + path));
  }
  for (const value of ['0', '-1', '1.5', '9007199254740992', '']) {
    assert.throws(() => routeIdentity(`${origin}/applications/review/999?application_id=${encodeURIComponent(value)}`));
  }
  assert.throws(() => routeIdentity('https://app.greenhouse.io.evil.test/applications/11'));
});

test('resolution verifies every route and Greenhouse identity hint against Harvest', async () => {
  const application = { id: 11, candidate_id: 21, prospect: false, jobs: [{ id: 31, name: 'Engineering' }], current_stage: { id: 41, name: 'Review' }, status: 'active', last_activity_at: '2026-09-24T12:00:00Z', rejected_at: null };
  const api = { application: async id => { assert.equal(id, '11'); return application; } };
  assert.equal(await resolveIdentity(api, { origin, applicationId: '11', candidateId: '21', jobId: '31', stageId: '41' }), application);
  await assert.rejects(resolveIdentity(api, { origin, applicationId: '11', candidateId: '22' }), /disagree/);
  await assert.rejects(resolveIdentity(api, { origin, applicationId: '11', jobId: '32' }), /disagree/);
});

test('candidate-only resolution requires exactly one matching application', async () => {
  const one = { id: 11, candidate_id: 21, prospect: false, jobs: [{ id: 31, name: 'Engineering' }], current_stage: { id: 41, name: 'Review' }, status: 'active', last_activity_at: '2026-09-24T12:00:00Z', rejected_at: null };
  const api = { list: async path => { assert.match(path, /candidate_ids=21/); assert.match(path, /job_ids=31/); return [{ id: 11, candidate_id: 21, job_id: 31 }]; }, application: async id => { assert.equal(id, '11'); return one; } };
  assert.equal(await resolveIdentity(api, { origin, candidateId: '21', jobId: '31' }), one);
  await assert.rejects(resolveIdentity({ list: async () => [{ id: 11, candidate_id: 21, job_id: 31 }, { id: 12, candidate_id: 21, job_id: 31 }], application: async () => one }, { origin, candidateId: '21' }), /Multiple applications/);
  await assert.rejects(resolveIdentity(api, { origin }), /No selected application/);
});
