import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
rmSync('dist', { recursive: true, force: true });
const result = spawnSync(process.platform === 'win32' ? 'tsc.cmd' : 'tsc', ['-p', 'tsconfig.json'], { stdio: 'inherit', shell: process.platform === 'win32' });
if (result.error || result.status !== 0) { console.error(result.error ?? 'TypeScript compilation failed'); process.exit(1); }
mkdirSync('dist', { recursive: true }); cpSync('manifest.json', 'dist/manifest.json');
console.log('Built dist/ without runtime dependencies. Load this directory unpacked in Chrome.');
cpSync('third_party/THIRD_PARTY_NOTICES.txt', 'dist/THIRD_PARTY_NOTICES.txt');
