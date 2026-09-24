// Test-only transformation: production dist/ is NEVER modified.
// Allows an isolated extension copy to interact with the loopback fixture.
import { readFileSync, writeFileSync } from 'node:fs';
const [directory, port] = process.argv.slice(2);
if (!directory || !/^\d+$/.test(port)) throw Error('Expected temporary extension directory and loopback port');
const manifest = JSON.parse(readFileSync(`${directory}/manifest.json`, 'utf8'));
manifest.content_scripts[0].matches = [`http://127.0.0.1:${port}/*`];
writeFileSync(`${directory}/manifest.json`, JSON.stringify(manifest));
let core = readFileSync(`${directory}/core.js`, 'utf8');
const start = core.indexOf('if (u.protocol !== "https:"');
const end = core.indexOf('return null;', start);
if (start < 0 || end < 0) throw Error('Production context guard changed; review fixture adapter');
core = core.slice(0,start) + `if (u.protocol !== "http:" || u.hostname !== "127.0.0.1" || u.port !== "${port}" || u.username || u.password)\n        ` + core.slice(end);
writeFileSync(`${directory}/core.js`, core);
