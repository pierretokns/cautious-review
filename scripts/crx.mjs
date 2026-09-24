// Independent implementation of Chromium's documented CRX3 container format.
// Specification: https://chromium.googlesource.com/chromium/src/+/refs/heads/main/components/crx_file/crx3.proto
// Algorithm: crx_verifier.cc uses RSA_PKCS1_SHA256 (the proto's old PSS comment is misleading).
import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify, constants } from 'node:crypto';
const sha = bytes => createHash('sha256').update(bytes).digest();
const u32 = n => { const b=Buffer.alloc(4); b.writeUInt32LE(n); return b; };
const varint = n => { const a=[]; do { let b=n & 127; n=Math.floor(n/128); a.push(b | (n ? 128 : 0)); } while(n); return Buffer.from(a); };
const field = (n, bytes) => Buffer.concat([varint(n*8+2),varint(bytes.length),bytes]);
const signingInput = (data, zip) => Buffer.concat([Buffer.from('CRX3 SignedData\0'),u32(data.length),data,zip]);
function fields(buffer) {
 let at=0; const result=[];
 function readVarint() { let n=0,scale=1; for(let i=0;i<5;i++){if(at>=buffer.length)throw Error('Truncated protobuf');const b=buffer[at++];n+=(b&127)*scale;if(!(b&128))return n;scale*=128;}throw Error('Oversized varint'); }
 while(at<buffer.length){const tag=readVarint();if((tag&7)!==2)throw Error('Unsupported protobuf wire type');const size=readVarint();if(size>buffer.length-at)throw Error('Invalid protobuf length');result.push({number:Math.floor(tag/8),bytes:buffer.subarray(at,at+size)});at+=size;}return result;
}
function single(f,n) { const list=f.filter(x=>x.number===n);if(list.length!==1)throw Error(`Missing/duplicate field ${n}`);return list[0].bytes; }
export function extensionId(id) { return [...id.toString('hex')].map(c=>String.fromCharCode(97+parseInt(c,16))).join(''); }
export function createCrx(zip, pem) {
 if(!Buffer.isBuffer(zip)||zip.length<4||zip.readUInt32LE(0)!==0x04034b50)throw Error('Expected ZIP archive');
 const key=pem?createPrivateKey(pem):generateKeyPairSync('rsa',{modulusLength:2048}).privateKey;
 if(key.asymmetricKeyType!=='rsa')throw Error('CRX signing key must be RSA');
 const pub=createPublicKey(key).export({format:'der',type:'spki'}),id=sha(pub).subarray(0,16),data=field(1,id);
 const signature=sign('sha256',signingInput(data,zip),{key,padding:constants.RSA_PKCS1_PADDING});
 const header=Buffer.concat([field(2,Buffer.concat([field(1,pub),field(2,signature)])),field(10000,data)]);
 const bytes=Buffer.concat([Buffer.from('Cr24'),u32(3),u32(header.length),header,zip]);
 const checked=verifyCrx(bytes,extensionId(id));
 return {bytes,extensionId:checked.extensionId,signingMode:pem?'provided-key':'ephemeral-preview-key'};
}
/** Cryptographic container check, not Web Store trust or an installation-policy bypass. */
export function verifyCrx(bytes,expectedId) {
 if(!Buffer.isBuffer(bytes)||bytes.length<16||bytes.length>40*1024*1024)throw Error('CRX size invalid');
 if(bytes.toString('ascii',0,4)!=='Cr24'||bytes.readUInt32LE(4)!==3)throw Error('Expected CRX3');
 const n=bytes.readUInt32LE(8);if(n>1024*1024||12+n>bytes.length-4)throw Error('CRX header length invalid');
 const header=fields(bytes.subarray(12,12+n)),data=single(header,10000),id=single(fields(data),1);
 if(id.length!==16)throw Error('CRX ID length invalid');
 const name=extensionId(id);if(expectedId&&name!==expectedId)throw Error('Unexpected extension ID');
 const zip=bytes.subarray(12+n);if(zip.readUInt32LE(0)!==0x04034b50)throw Error('Missing ZIP payload');
 const input=signingInput(data,zip),proofs=header.filter(f=>f.number===2||f.number===3);let developer=false;
 if(!proofs.length)throw Error('Missing signature proofs');
 for(const proof of proofs){
  const f=fields(proof.bytes),pub=single(f,1),sig=single(f,2),key=createPublicKey({key:pub,format:'der',type:'spki'});
  if((proof.number===2&&key.asymmetricKeyType!=='rsa')||(proof.number===3&&key.asymmetricKeyType!=='ec'))throw Error('Key algorithm mismatch');
  const options=proof.number===2?{key,padding:constants.RSA_PKCS1_PADDING}:key;
  if(!verify('sha256',input,options,sig))throw Error('Invalid CRX signature');
  if(sha(pub).subarray(0,16).equals(id))developer=true;
 }
 if(!developer)throw Error('No developer proof for declared ID');
 return {extensionId:name,zip,proofs:proofs.length,format:3};
}
