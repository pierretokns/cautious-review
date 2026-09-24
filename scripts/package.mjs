import { mkdirSync, readFileSync, readdirSync, writeFileSync, statSync, utimesSync, copyFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const manifest = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
if (manifest.manifest_version !== 3 || manifest.host_permissions?.length) throw Error('Unexpected manifest permissions');
for (const name of ['content.js', 'background.js', 'core.js', 'storage.js']) {
  const body = readFileSync(`dist/${name}`, 'utf8');
  if (/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(/.test(body)) throw Error(`Unexpected network code in ${name}`);
}
mkdirSync('artifacts', { recursive: true });
// zip -X with a stable timestamp and sorted inputs; requires the OS zip utility.
const epoch = new Date('2026-01-01T00:00:00Z');
for (const name of readdirSync('dist')) if (statSync(`dist/${name}`).isFile()) utimesSync(`dist/${name}`, epoch, epoch);
const asset = `cautious-review-${manifest.version}.zip`;
rmSync(`artifacts/${asset}`, { force: true });
execFileSync('zip', ['-X', '-q', `../artifacts/${asset}`, ...readdirSync('dist').sort()], { cwd: 'dist', env: { ...process.env, TZ: 'UTC' } });
execFileSync('unzip', ['-t', `artifacts/${asset}`], { stdio: 'inherit' });
const hash = createHash('sha256').update(readFileSync(`artifacts/${asset}`)).digest('hex');
writeFileSync('artifacts/SHA256SUMS', `${hash}  ${asset}\n`);
console.log(`${asset}: ${hash}`);
