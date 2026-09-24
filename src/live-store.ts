import type { LiveReceipt } from './harvest.js';
const DB='cautious-review-live-v1';
async function db():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open(DB,1);r.onupgradeneeded=()=>{r.result.createObjectStore('receipts',{autoIncrement:true});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}
export async function saveReceipt(receipt:LiveReceipt){const d=await db();try{await new Promise<void>((resolve,reject)=>{const t=d.transaction('receipts','readwrite');t.objectStore('receipts').add(receipt);t.oncomplete=()=>resolve();t.onabort=t.onerror=()=>reject(t.error);});}finally{d.close();}}
export async function receipts():Promise<LiveReceipt[]>{const d=await db();try{return await new Promise((resolve,reject)=>{const r=d.transaction('receipts').objectStore('receipts').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});}finally{d.close();}}
async function clearAllReceipts(){const d=await db();try{await new Promise<void>((resolve,reject)=>{const t=d.transaction('receipts','readwrite');t.objectStore('receipts').clear();t.oncomplete=()=>resolve();t.onabort=t.onerror=()=>reject(t.error);});}finally{d.close();}}
/** Serialize destructive receipt clearing with the page-wide live-write lock. */
export async function clearReceipts(){
 if(typeof navigator!=='undefined'&&navigator.locks) return navigator.locks.request('cautious-review-live-write',()=>clearAllReceipts());
 return clearAllReceipts();
}
export function receiptBlocks(rows:LiveReceipt[],id:string,planId?:string){const matching=rows.filter(r=>r.applicationId===id);if(planId&&matching.some(r=>r.planId===planId))return true;const latestByPlan=new Map<string,LiveReceipt>();for(const r of matching)if(['started','unknown','succeeded','failed','cancelled'].includes(r.status))latestByPlan.set(r.planId,r);return [...latestByPlan.values()].some(r=>r.status==='started'||r.status==='unknown');}
export async function blockedApplication(id:string,planId?:string){return receiptBlocks(await receipts(),id,planId);}
