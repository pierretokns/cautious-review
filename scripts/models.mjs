import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';import {dirname} from 'node:path';import {createHash} from 'node:crypto';
const manifest=JSON.parse(readFileSync('third_party/MODEL.json','utf8'));
for(const file of manifest.files){const path='model-assets/minilm/'+file.path;let bytes=existsSync(path)?readFileSync(path):null;
if(!bytes){const r=await fetch(file.url);if(!r.ok)throw Error('Model download failed: '+r.status);bytes=Buffer.from(await r.arrayBuffer());}
if(createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw Error('Model checksum mismatch: '+file.path);
mkdirSync(dirname(path),{recursive:true});writeFileSync(path,bytes);}
console.log('Verified pinned local model assets. No candidate data is involved.');
