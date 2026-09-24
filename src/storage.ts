export type Decision="advance"|"maybe"|"reject";
export interface ReviewRecord{candidateKey:string;candidateName?:string;decision:Decision;reason?:string;createdAt:string;sourceUrl:string}
export interface CandidateDocument{key:string;name?:string;url:string;text:string;indexedAt:string}
const NAME="cautious-review", VERSION=1;
function db():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open(NAME,VERSION);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains("reviews"))d.createObjectStore("reviews",{keyPath:"candidateKey"});if(!d.objectStoreNames.contains("candidates"))d.createObjectStore("candidates",{keyPath:"key"})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function put<T>(store:string,value:T){const d=await db();await new Promise<void>((resolve,reject)=>{const tx=d.transaction(store,"readwrite");tx.objectStore(store).put(value);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)});d.close()}
export const saveReview=(x:ReviewRecord)=>put("reviews",x);
export const saveCandidate=(x:CandidateDocument)=>put("candidates",x);
export async function deleteReview(key:string){const d=await db();await new Promise<void>((resolve,reject)=>{const tx=d.transaction("reviews","readwrite");tx.objectStore("reviews").delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)});d.close()}
export async function allCandidates():Promise<CandidateDocument[]>{const d=await db();const out=await new Promise<CandidateDocument[]>((resolve,reject)=>{const tx=d.transaction("candidates","readonly");const r=tx.objectStore("candidates").getAll();r.onsuccess=()=>resolve(r.result as CandidateDocument[]);r.onerror=()=>reject(r.error)});d.close();return out}
