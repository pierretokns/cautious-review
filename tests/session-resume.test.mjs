import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionReadContext, attachmentPreviewPath, previewDocumentURL } from '../dist/session-resume.js';

const origin = 'https://app.greenhouse.io';
const storage = 'https://grnhse-dochouse-prod.s3.amazonaws.com/resumes/abc.pdf?X-Amz-Signature=private';

test('requires one unambiguous application and candidate across page and selected links', () => {
  const result = sessionReadContext(`${origin}/people/21`, [
    `${origin}/people/21/applications/11/redesign`,
  ]);
  assert.deepEqual(result, {
    key: `${origin}|application:11`, origin, candidateId: '21', applicationId: '11',
    url: `${origin}/people/21/applications/11`,
  });

  assert.throws(() => sessionReadContext(`${origin}/applications/review/999`, [
    `${origin}/people/21/applications/11`, `${origin}/people/22/applications/12`,
  ]), /one specific candidate application/i);
  assert.throws(() => sessionReadContext(`${origin}/people/21/applications/11`, [
    `${origin}/people/21/applications/12`,
  ]), /one specific candidate application/i);
});

test('rejects identity disagreement and unsupported page origins', () => {
  assert.throws(() => sessionReadContext(`${origin}/people/21/applications/11`, [
    `${origin}/people/22/applications/11`,
  ]), /one specific candidate application/i);
  assert.throws(() => sessionReadContext(`${origin}/people/21/applications/11?candidate_id=22`), /Ambiguous Greenhouse identity/i);
  assert.throws(() => sessionReadContext('https://evil.test/people/21/applications/11'), /Unsupported Greenhouse origin/i);
});

test('constructs preview paths only from bounded positive decimal attachment IDs', () => {
  assert.equal(attachmentPreviewPath('42'), '/attachment_previews/42?width=800');
  assert.equal(attachmentPreviewPath('9'.repeat(20)), `/attachment_previews/${'9'.repeat(20)}?width=800`);
  for (const id of ['0', '-1', '01', '1.0', '1/2', '1?x=2', 'x', '9'.repeat(21), '']) {
    assert.throws(() => attachmentPreviewPath(id), /Invalid résumé attachment identity/i, id);
  }
});

test('extracts only approved Greenhouse document storage URLs and keeps signed query parameters', () => {
  assert.equal(previewDocumentURL({ source: storage }), storage);
  const wrapper = new URL('https://app.greenhouse.io/attachment_previews/42');
  wrapper.searchParams.set('document_url', storage);
  assert.equal(previewDocumentURL({ source: wrapper.href }), storage);
  assert.equal(previewDocumentURL({ source: 'https://grnhse-dochouse-prod-eu.s3.eu-central-1.amazonaws.com/x.pdf?signature=ok' }),
    'https://grnhse-dochouse-prod-eu.s3.eu-central-1.amazonaws.com/x.pdf?signature=ok');
});

test('fails closed on malformed, ambiguous, oversized, or unapproved preview URLs', () => {
  for (const payload of [null, [], 'https://grnhse-dochouse-prod.s3.amazonaws.com/a.pdf', {}, { source: 4 }, { source: 'not a URL' }]) {
    assert.throws(() => previewDocumentURL(payload));
  }
  assert.throws(() => previewDocumentURL({ source: `https://app.greenhouse.io/?document_url=${encodeURIComponent(storage)}&document_url=${encodeURIComponent(storage)}` }), /Ambiguous/i);
  for (const source of [
    'http://grnhse-dochouse-prod.s3.amazonaws.com/a.pdf',
    'https://grnhse-dochouse-prod.s3.amazonaws.com.evil.test/a.pdf',
    'https://user:pass@grnhse-dochouse-prod.s3.amazonaws.com/a.pdf',
    'https://grnhse-dochouse-prod.s3.amazonaws.com:444/a.pdf',
    'https://attacker.test/a.pdf',
  ]) assert.throws(() => previewDocumentURL({ source }), /Invalid Greenhouse preview URL|Attachment host not approved/i, source);
  assert.throws(() => previewDocumentURL({ source: 'https://app.greenhouse.io/' + 'x'.repeat(16001) }), /no usable document URL/i);
});
