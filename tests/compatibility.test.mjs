import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HOSTS, contextFor } from '../dist/core.js';
import { sanitizeObservation } from '../dist/session-diagnostics.js';

const manifest = JSON.parse(readFileSync(new URL('../dist/manifest.json', import.meta.url)));

test('every recruiter host activates both content worlds, identity and diagnostics', () => {
  const expected = [...HOSTS].map(host => `https://${host}/*`).sort();
  assert.equal(manifest.content_scripts.length, 2);
  for (const host of expected) assert.ok(manifest.host_permissions.includes(host), `Current-tab identity access: ${host}`);
  assert.ok(!manifest.permissions?.includes('tabs'), 'No global tab-history permission');
  for (const script of manifest.content_scripts) {
    assert.deepEqual([...script.matches].sort(), expected);
    assert.equal(script.all_frames, false);
  }
  for (const host of HOSTS) {
    const url = `https://${host}/people/21/applications/11/redesign`;
    assert.equal(contextFor(url)?.applicationId, '11', host);
    assert.ok(sanitizeObservation({method:'GET',url,status:200}), host);
  }
});

test('manifest browser floor includes PDF.js Promise.try dependency', () => {
  // The bundled modern PDF.js uses Promise.try, shipped in Chrome 128.
  assert.ok(Number(manifest.minimum_chrome_version) >= 128);
});

test('installed extension version agrees with package and displayed metadata', () => {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  assert.equal(manifest.version, pkg.version);
  for (const file of ['content.js','background.js','session-ui.js','live.html']) {
    assert.ok(readFileSync(new URL(`../dist/${file}`, import.meta.url), 'utf8').includes(pkg.version), file);
  }
});
