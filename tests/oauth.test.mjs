import test from 'node:test';
import assert from 'node:assert/strict';
import { requestToken } from '../scripts/harvest-token.mjs';

const good = { token_type: 'Bearer', access_token: 'x'.repeat(32), expires_in: 3600 };

test('token helper posts only to Greenhouse OAuth with client credentials and actor sub', async () => {
  let seen;
  const result = await requestToken('client-123', 'secret-value', '42', async (url, init) => {
    seen = { url, init };
    return Response.json(good);
  });
  assert.equal(seen.url, 'https://auth.greenhouse.io/token');
  assert.equal(seen.init.method, 'POST');
  assert.equal(seen.init.redirect, 'error');
  assert.equal(seen.init.credentials, 'omit');
  assert.equal(seen.init.headers.Authorization, `Basic ${Buffer.from('client-123:secret-value').toString('base64')}`);
  assert.equal(seen.init.headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.deepEqual([...seen.init.body.entries()], [['grant_type', 'client_credentials'], ['sub', '42']]);
  assert.deepEqual(result, { accessToken: good.access_token, expiresIn: 3600 });
});

test('client ID, secret and actor validation happen before any network request', async () => {
  let calls = 0;
  const transport = async () => { calls++; return Response.json(good); };
  for (const id of ['', 'bad:id', 'bad\r\nHeader']) await assert.rejects(requestToken(id, 'secret', '42', transport));
  for (const secret of ['', 'bad\nsecret']) await assert.rejects(requestToken('client', secret, '42', transport));
  for (const actor of ['', '0', '1.2', '9007199254740992']) await assert.rejects(requestToken('client', 'secret', actor, transport));
  assert.equal(calls, 0);
});

test('HTTP and transport failures do not expose credential or response bodies', async () => {
  const privateText = 'secret-value bearer-token-value';
  await assert.rejects(requestToken('client', 'secret-value', '42', async () => new Response(privateText, { status: 403 })), error => {
    assert.match(error.message, /HTTP 403/);
    assert.doesNotMatch(error.message, /secret-value|bearer-token-value/);
    return true;
  });
  await assert.rejects(requestToken('client', 'secret-value', '42', async () => { throw new Error(privateText); }), error => {
    assert.match(error.message, /Could not reach Greenhouse OAuth/);
    assert.doesNotMatch(error.message, /secret-value|bearer-token-value/);
    return true;
  });
});

test('malformed OAuth responses are rejected without returning token-like data', async () => {
  for (const payload of [
    {},
    { token_type: 'Basic', access_token: 'x'.repeat(32), expires_in: 3600 },
    { token_type: 'Bearer', access_token: 'short', expires_in: 3600 },
    { token_type: 'Bearer', access_token: 'x'.repeat(32), expires_in: 0 },
  ]) {
    await assert.rejects(requestToken('client', 'secret', '42', async () => Response.json(payload)), /incomplete token response/);
  }
  await assert.rejects(requestToken('client', 'secret', '42', async () => new Response('not-json')), /invalid token response/);
});
