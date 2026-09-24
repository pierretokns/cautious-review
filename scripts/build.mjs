import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { build } from 'esbuild';
rmSync('dist', { recursive: true, force: true });
const result = spawnSync(process.platform === 'win32' ? 'tsc.cmd' : 'tsc', ['-p', 'tsconfig.json'], { stdio: 'inherit', shell: process.platform === 'win32' });
if (result.error || result.status !== 0) { console.error(result.error ?? 'TypeScript compilation failed'); process.exit(1); }
await build({entryPoints:['src/session-ui.ts','src/session-observer.ts'],outdir:'dist',bundle:true,format:'iife',target:'chrome120',legalComments:'none'});
mkdirSync('dist', { recursive: true }); cpSync('manifest.json', 'dist/manifest.json');
console.log('Compiled extension source. Load this directory unpacked in Chrome.');
cpSync('third_party/THIRD_PARTY_NOTICES.txt', 'dist/THIRD_PARTY_NOTICES.txt');

cpSync('static', 'dist', { recursive: true });
mkdirSync('dist/vendor', { recursive: true });
for (const name of ['pdf.mjs','pdf.worker.mjs']) cpSync('node_modules/pdfjs-dist/build/'+name, 'dist/vendor/'+name);
cpSync('node_modules/pdfjs-dist/LICENSE','dist/vendor/PDFJS-LICENSE.txt');

for(const name of ['transformers.min.js','ort-wasm-simd-threaded.jsep.mjs','ort-wasm-simd-threaded.jsep.wasm']) cpSync('node_modules/@huggingface/transformers/dist/'+name,'dist/vendor/'+name);
cpSync('node_modules/@huggingface/transformers/LICENSE','dist/vendor/TRANSFORMERS-LICENSE.txt');
cpSync('node_modules/@huggingface/jinja/LICENSE','dist/vendor/JINJA-LICENSE.txt');
cpSync('third_party/ONNX-LICENSE.txt','dist/vendor/ONNX-LICENSE.txt');
cpSync('third_party/ONNX-ThirdPartyNotices.txt','dist/vendor/ONNX-ThirdPartyNotices.txt');
cpSync('model-assets/minilm','dist/models/minilm',{recursive:true});
cpSync('third_party/MiniLM-LICENSE.txt','dist/models/minilm/LICENSE');
