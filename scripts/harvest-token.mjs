import readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { pathToFileURL } from 'node:url';

const TOKEN_URL = 'https://auth.greenhouse.io/token';

export async function requestToken(clientId, clientSecret, actorId, transport = fetch) {
  if (typeof clientId !== 'string' || !/^[\x21-\x7e]{1,500}$/.test(clientId) || clientId.includes(':')) {
    throw new Error('Enter a valid OAuth client ID.');
  }
  if (typeof clientSecret !== 'string' || !clientSecret || /[\r\n\u0000-\u001f\u007f]/.test(clientSecret)) {
    throw new Error('Enter a valid OAuth client secret.');
  }
  if (typeof actorId !== 'string' || !/^[1-9]\d*$/.test(actorId) || !Number.isSafeInteger(Number(actorId))) {
    throw new Error('Enter a positive numeric Greenhouse user ID.');
  }
  let response;
  try {
    response = await transport(TOKEN_URL, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`, 'utf8').toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ grant_type: 'client_credentials', sub: actorId }),
      credentials: 'omit',
      redirect: 'error',
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error('Could not reach Greenhouse OAuth. No credential or response data was printed.');
  }
  if (!response.ok) throw new Error(`Greenhouse OAuth rejected the request (HTTP ${response.status}).`);

  let payload;
  try { payload = await response.json(); }
  catch { throw new Error('Greenhouse returned an invalid token response.'); }
  const token = payload?.access_token;
  const expiresIn = Number(payload?.expires_in);
  if (payload?.token_type !== 'Bearer' || typeof token !== 'string' || token.length < 20 || !Number.isFinite(expiresIn) || expiresIn <= 0) {
    throw new Error('Greenhouse returned an incomplete token response.');
  }
  return { accessToken: token, expiresIn };
}

async function promptVisible(question) {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  try { return (await rl.question(question)).trim(); }
  finally { rl.close(); }
}

function promptSecret(question) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error('Run this helper in a terminal so the client secret can stay masked.');
  }
  return new Promise((resolve, reject) => {
    const oldRawMode = stdin.isRaw;
    let secret = '';
    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      stdin.removeListener('data', onData);
      stdin.setRawMode(oldRawMode ?? false);
      stdin.pause();
    };
    const onData = chunk => {
      for (const char of String(chunk)) {
        if (char === '\u0003') {
          secret = '';
          cleanup();
          stdout.write('\n');
          reject(new Error('Cancelled.'));
          return;
        }
        if (char === '\r' || char === '\n') {
          cleanup();
          stdout.write('\n');
          resolve(secret);
          secret = '';
          return;
        }
        if (char === '\u0008' || char === '\u007f') secret = secret.slice(0, -1);
        else if (char >= ' ' && char !== '\u007f') secret += char;
      }
    };
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    stdin.on('data', onData);
  });
}

async function main() {
  if (!stdin.isTTY || !stdout.isTTY) throw new Error('Run this helper in an interactive terminal.');
  const clientId = await promptVisible('Harvest v3 OAuth client ID: ');
  const actorId = await promptVisible('Greenhouse user ID (sub): ');
  if (!clientId) throw new Error('Enter a client ID.');
  let clientSecret = await promptSecret('Harvest v3 OAuth client secret (input hidden): ');
  if (!clientSecret) throw new Error('Client secret is required.');
  const tokenPromise = requestToken(clientId, clientSecret, actorId);
  clientSecret = '';
  const { accessToken: token, expiresIn } = await tokenPromise;

  const approved = await promptVisible(`Token is valid for about ${Math.floor(expiresIn / 60)} minutes. Print it once so you can copy it into Cautious Review? (y/N): `);
  if (approved.toLowerCase() !== 'y') {
    throw new Error('Token was not printed. Run the helper again when ready to copy it.');
  }
  // This is the only code path that writes the access token to the terminal.
  stdout.write(`${token}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : 'Token creation failed.');
    process.exitCode = 1;
  });
}
