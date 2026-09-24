/** Static-only GreenMaxing CRX inspector. Never executes extension code or uses applicant data.
 * Usage: npm run audit:greenmaxing -- /path/to/file.crx OR --download
 */
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { verifyCrx } from './crx.mjs';
const EXPECTED_ID = 'npplpgbebfjnhmnaehlbhiohclhfgcml';
const MAX_CRX = 20 * 1024 * 1024;
const arg = process.argv[2];
mkdirSync('audit-artifacts', { recursive: true });
const directory = mkdtempSync(join(tmpdir(), 'greenmaxing-audit-'));
async function downloadPublicCrx() {
 const update = new URL('https://clients2.google.com/service/update2/crx');
 update.search = new URLSearchParams({response:'redirect', prodversion:'150.0.0.0', acceptformat:'crx3', x:`id=${EXPECTED_ID}&installsource=ondemand&uc`}).toString();
 let url = update.href;
 for (let i = 0; i < 6; i++) {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !/(^|\.)google\.com$|(^|\.)googleusercontent\.com$/.test(u.hostname)) throw Error('Unexpected download host');
  const response = await fetch(u, {redirect:'manual', signal:AbortSignal.timeout(30000)});
  if (response.status >= 300 && response.status < 400) { const location=response.headers.get('location'); if(!location)throw Error('Redirect has no location'); url=new URL(location,u).href; continue; }
  if(!response.ok || !response.body)throw Error(`Download unavailable: HTTP ${response.status}`);
  const chunks=[];let size=0;
  for await(const chunk of response.body){size+=chunk.length;if(size>MAX_CRX)throw Error('Download exceeds 20 MB safety limit');chunks.push(chunk);}
  return Buffer.concat(chunks);
 }
 throw Error('Too many CRX redirects');
}
function readEntry(zip,name,limit=2*1024*1024){return execFileSync('unzip',['-p',zip,name],{encoding:'utf8',maxBuffer:limit,timeout:10000});}
try {
 if(!arg)throw Error('Pass a GreenMaxing .crx path, or use --download to request the public Web Store package');
 const bytes=arg==='--download'?await downloadPublicCrx():readFileSync(resolve(arg));
 if(bytes.length>MAX_CRX)throw Error('CRX exceeds 20 MB safety limit');
 const checked=verifyCrx(bytes,EXPECTED_ID),zip=join(directory,'package.zip');writeFileSync(zip,checked.zip);
 const names=execFileSync('unzip',['-Z','-1',zip],{encoding:'utf8',maxBuffer:1024*1024,timeout:10000}).trim().split('\n').filter(Boolean);
 if(names.length>10000||names.some(n=>n.startsWith('/')||n.includes('..')||n.includes('\\')||n.includes('\0')))throw Error('Suspicious archive paths');
 const manifest=JSON.parse(readEntry(zip,'manifest.json'));
 const domains=new Set(),indicators=[];let scanned=0;
 const patterns={network:/\b(fetch|XMLHttpRequest|WebSocket|sendBeacon)\s*\(/g,dynamicCode:/\b(eval\s*\(|new\s+Function\s*\()/g,syncStorage:/\b(?:chrome|browser)\.storage\.sync\b/g,cookies:/\b(?:chrome|browser)\.cookies\b/g,remoteMessaging:/\bonMessageExternal\b/g};
 for(const name of names.filter(n=>/\.(?:js|json|html|css)$/i.test(n))){
  const text=readEntry(zip,name);scanned+=Buffer.byteLength(text);if(scanned>30*1024*1024)throw Error('Uncompressed text exceeds 30 MB scan limit');
  for(const match of text.matchAll(/https?:\/\/[^\s"'`<>\\)]+/g)){try{domains.add(new URL(match[0]).hostname);}catch{}}
  for(const[kind,regex]of Object.entries(patterns)){regex.lastIndex=0;const count=[...text.matchAll(regex)].length;if(count)indicators.push({file:name,kind,count});}
 }
 const report={status:'static-inspection-complete',extensionId:checked.extensionId,version:manifest.version,sha256:createHash('sha256').update(bytes).digest('hex'),size:bytes.length,signatureProofsVerified:checked.proofs,
 manifest:{manifest_version:manifest.manifest_version,permissions:manifest.permissions??[],host_permissions:manifest.host_permissions??[],optional_permissions:manifest.optional_permissions??[],optional_host_permissions:manifest.optional_host_permissions??[],content_security_policy:manifest.content_security_policy??null,externally_connectable:manifest.externally_connectable??null,update_url:manifest.update_url??null,content_scripts:manifest.content_scripts??[],background:manifest.background??null},
 files:names,staticDomains:[...domains].sort(),indicators,limitations:['Static matches are leads, not proof of network behavior; computed URLs and obfuscation can evade this scan.','No dynamic testing, Greenhouse login, applicant data, or corporate-data safety certification.','Extension code was never executed and the proprietary CRX/source is not redistributed.']};
 writeFileSync('audit-artifacts/greenmaxing-report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}catch(error){const report={status:'blocked',error:error instanceof Error?error.message:String(error),extensionId:EXPECTED_ID};writeFileSync('audit-artifacts/greenmaxing-report.json',JSON.stringify(report,null,2)+'\n');console.error(JSON.stringify(report));process.exitCode=1;}
finally{rmSync(directory,{recursive:true,force:true});}
