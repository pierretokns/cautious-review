/** Adapted from open-greenhouse-mcp client.py, applications.py, attachments.py.
 * MIT Copyright (c) 2026 Ben Monopoli. Exact provenance: docs/PRIOR-ART.md.
 * Restricted endpoints, fail-closed pagination, bounded reads, no blind mutation retries.
 */
export const API = 'https://harvest.greenhouse.io/v3';
export function numericId(value: unknown): string {
 const s = String(value ?? '');
 if (!/^[1-9]\d*$/.test(s) || !Number.isSafeInteger(Number(s))) throw Error('Invalid Greenhouse ID');
 return s;
}
export class HarvestError extends Error {
 constructor(public status: number, public uncertain = false) {
  super(({401:'Harvest v3 bearer token expired or invalid',403:'Harvest permission denied',404:'Greenhouse record not found',422:'Greenhouse rejected the request',429:'Greenhouse rate limit reached'} as Record<number,string>)[status] ?? (status >= 500 ? 'Greenhouse server error' : 'Greenhouse request failed'));
 }
}
function tokenMatchesActor(token:string,actor:string):boolean {
 try {
  const part=token.split('.')[1];if(!part)return false;
  const base64=part.replace(/-/g,'+').replace(/_/g,'/').padEnd(Math.ceil(part.length/4)*4,'=');
  const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));const claims=JSON.parse(new TextDecoder().decode(bytes));
  return String(claims.sub)===actor&&Number.isFinite(claims.exp)&&claims.exp*1000>Date.now();
 } catch { return false; }
}
export const sleep = (ms: number, signal?: AbortSignal) => new Promise<void>((resolve,reject) => {
 if (signal?.aborted) return reject(new DOMException('Cancelled','AbortError'));
 const onAbort = () => { clearTimeout(timer); reject(new DOMException('Cancelled','AbortError')); };
 const timer = setTimeout(() => { signal?.removeEventListener('abort',onAbort); resolve(); },ms);
 signal?.addEventListener('abort',onAbort,{once:true});
});
export function retryDelay(value: string | null, now = Date.now()): number {
 if (value && /^\d+(\.\d+)?$/.test(value)) { const seconds=Number(value); return Number.isFinite(seconds)?Math.min(seconds*1000,86_400_000):1000; }
 const date = value ? Date.parse(value) : NaN;
 return Number.isFinite(date) ? Math.min(86_400_000,Math.max(0,date-now)) : 1000;
}
export function apiURL(path: string): string {
 const u = new URL(path.startsWith('/') ? API+path : path);
 if (u.origin !== 'https://harvest.greenhouse.io' || !u.pathname.startsWith('/v3/') || u.username || u.password || u.hash) throw Error('Unsafe Harvest URL');
 return u.href;
}
export async function boundedBytes(response: Response, max = 20_000_000): Promise<Uint8Array> {
 if (Number(response.headers.get('content-length')) > max) throw Error('Attachment exceeds 20 MB');
 const reader = response.body?.getReader(); if (!reader) throw Error('Empty response');
 const chunks: Uint8Array[] = []; let size=0;
 try { while(true) { const {done,value}=await reader.read(); if(done) break; size+=value.length; if(size>max) throw Error('Response exceeds size limit'); chunks.push(value); } }
 catch(e) { await reader.cancel(); throw e; }
 const bytes=new Uint8Array(size); let offset=0; for(const c of chunks){bytes.set(c,offset);offset+=c.length;} return bytes;
}
export class Harvest {
 nextAt=0;
 constructor(private token:string, public actor:string, private transport:typeof fetch=fetch, private wait=sleep, private random=Math.random) {
  numericId(actor); if (!/^eyJ[\w-]+\.[\w-]+\.[\w-]+$/.test(token)||!tokenMatchesActor(token,actor)) throw Error('Enter a valid unexpired Harvest v3 token for this Greenhouse user');
 }
 async request(path:string, method='GET', body?:unknown, signal?:AbortSignal):Promise<{data:any; response:Response}> {
  const url=apiURL(path);
  for(let attempt=0;attempt<4;attempt++) {
   await this.wait(Math.max(0,this.nextAt-Date.now()),signal);
   let response:Response;
   try { response=await (0,this.transport)(url,{method,headers:{Authorization:'Bearer '+this.token,...(method==='GET'||body===undefined?{}:{'Content-Type':'application/json'})},body:method==='GET'||body===undefined?undefined:JSON.stringify(body),credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:signal ? AbortSignal.any([signal,AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000)}); }
   catch(e) { if(signal?.aborted) throw new DOMException('Cancelled','AbortError'); throw new HarvestError(0,method!=='GET'); }
   this.nextAt=Date.now()+200;
   if(response.headers.get('x-ratelimit-remaining')==='0') { const reset=Number(response.headers.get('x-ratelimit-reset'))*1000; if(Number.isFinite(reset))this.nextAt=Math.max(this.nextAt,reset); }
   if(response.status===429) {
    const delay=retryDelay(response.headers.get('retry-after')); this.nextAt=Math.max(this.nextAt,Date.now()+delay+this.random()*Math.min(delay/2,2000));
    // Retry only reads. Mutations must return through fresh preflight and human confirmation.
    if(method==='GET' && attempt<3 && delay<=60000) continue;
   }
   if(!response.ok) throw new HarvestError(response.status,method!=='GET'&&(response.status>=500||response.status===408));
   if(response.status===204||response.status===205||response.headers.get('content-length')==='0')return {data:null,response};
   try { const bytes=await boundedBytes(response,10_000_000); const data=bytes.length?JSON.parse(new TextDecoder().decode(bytes)):null; return {data,response}; }
   catch { throw new HarvestError(0,method!=='GET'); }
  }
  throw new HarvestError(429);
 }
 async get(path:string,signal?:AbortSignal){return (await this.request(path,'GET',undefined,signal)).data;}
 async list(path:string,signal?:AbortSignal):Promise<any[]> {
  let next:string|null=apiURL(path); const seen=new Set<string>(),items:any[]=[];
  while(next) {
   if(seen.has(next)||seen.size>=200) throw Error('Pagination cycle or limit; results discarded'); seen.add(next);
   const {data,response}=await this.request(next,'GET',undefined,signal);
   if(!Array.isArray(data)) throw Error('Invalid Harvest list response'); if(items.length+data.length>50_000)throw Error('Harvest list exceeds record limit; results discarded'); items.push(...data);
   const link=response.headers.get('link'); const match=link?.match(/<([^>]+)>;\s*rel="next"/);
   next=match?apiURL(match[1]):null;
  }
  return items;
 }
 async application(id:string,signal?:AbortSignal){
  const applicationId=numericId(id),rows=await this.list(`/applications?ids=${applicationId}&per_page=2`,signal);
  if(rows.length!==1||numericId(rows[0]?.id)!==applicationId)throw Error('Application response mismatch');
  const raw=rows[0],jobId=numericId(raw.job_id),stagePointer=numericId(raw.stage_id),history=await this.list(`/application_stages?ids=${stagePointer}&per_page=2`,signal);
  if(history.length!==1||numericId(history[0]?.application_id)!==applicationId||numericId(history[0]?.id)!==stagePointer||(raw.status==='active'&&(history[0].current!==true||history[0].exited_at!==null)))throw Error('Application stage history is ambiguous or stale');
  const stageId=numericId(history[0].job_interview_stage_id),jobs=await this.list(`/jobs?ids=${jobId}&per_page=2`,signal),stages=await this.stages(jobId,signal,false);
  const job=jobs.find(j=>String(j.id)===jobId),stage=stages.find(s=>String(s.id)===stageId);
  if(jobs.length!==1||!job||!stage)throw Error('Application job or current stage could not be resolved');
  let rejectionReasonId:string|null=null;
  if(raw.status==='rejected'){
   const details=await this.list(`/rejection_details?application_ids=${applicationId}&per_page=2`,signal);
   if(details.length!==1||numericId(details[0]?.application_id)!==applicationId)throw Error('Rejected application details are missing or ambiguous');
   rejectionReasonId=numericId(details[0].rejection_reason_id??details[0].rejection_reason?.id??raw.rejection_reason_id);
  }
  return {...raw,rejection_reason_id:rejectionReasonId,jobs:[{id:jobId,name:job.name}],current_stage:{id:stageId,name:stage.name}};
 }
 async stages(job:string,signal?:AbortSignal,active=true){return (await this.list(`/job_interview_stages?job_ids=${numericId(job)}${active?'&active=true':''}&per_page=100`,signal)).map(s=>({...s,priority:s.sort_order}));}
}
export interface Snapshot {applicationId:string;candidateId:string;jobId:string;stageId:string;status:string;lastActivity:string;rejectedAt:string|null;rejectionReasonId:string|null}
export function snapshot(a:any):Snapshot {
 if(!a||a.prospect!==false||!Array.isArray(a.jobs)||a.jobs.length!==1||typeof a.jobs[0]?.name!=='string'||typeof a.current_stage?.name!=='string'||!['active','rejected'].includes(a.status)||typeof a.last_activity_at!=='string'||!Number.isFinite(Date.parse(a.last_activity_at))) throw Error('Application must have one job, a stage, and active/rejected status');
 const rejectedAt=a.rejected_at??null;
 if(rejectedAt!==null&&(typeof rejectedAt!=='string'||!Number.isFinite(Date.parse(rejectedAt))))throw Error('Invalid rejection timestamp');
 const rejectionReasonId=a.status==='rejected'?numericId(a.rejection_reason_id):null;
 return {applicationId:numericId(a.id),candidateId:numericId(a.candidate_id),jobId:numericId(a.jobs[0].id),stageId:numericId(a.current_stage?.id),status:a.status,lastActivity:a.last_activity_at,rejectedAt,rejectionReasonId};
}
export type Action = 'reject'|'advance'|'move'|'unreject';
export interface LiveItem { before:Snapshot; action:Action; reasonId?:string; targetStageId?:string; label:string; targetLabel?:string; reasonLabel?:string; evidence?:{sourceSha256:string;engineVersion:string;criteria:string;analyzedAt:string} }
export interface LivePlan { id:string;actor:string;createdAt:number;items:LiveItem[] }
export interface LiveReceipt {planId:string;actor:string;applicationId:string;action:Action;status:'started'|'succeeded'|'failed'|'unknown'|'skipped'|'cancelled';at:string;detail?:string;before:Snapshot;after?:Snapshot;request?:{method:'POST';path:string;body?:Record<string,number>};evidence?:LiveItem['evidence']}
export function actionBody(item:LiveItem):Record<string,number>|undefined {
 const s=item.before; numericId(s.applicationId);numericId(s.stageId);
 if(item.action==='reject') return {rejection_reason_id:Number(numericId(item.reasonId))};
 if(item.action==='unreject') return undefined;
 if(item.action==='advance') return {from_stage_id:Number(s.stageId)};
 if(item.action==='move') return {from_stage_id:Number(s.stageId),to_stage_id:Number(numericId(item.targetStageId))};
 throw Error('Unsupported action');
}
export function actionPath(item:LiveItem):string { numericId(item.before.applicationId); return `/applications/${item.before.applicationId}/${item.action==='advance'||item.action==='move'?'move':item.action}`; }
export function reached(item:LiveItem,after:Snapshot):boolean {
 if(after.applicationId!==item.before.applicationId||after.candidateId!==item.before.candidateId||after.jobId!==item.before.jobId) return false;
 return item.action==='reject'?after.status==='rejected'&&after.stageId===item.before.stageId&&after.rejectionReasonId===item.reasonId:item.action==='unreject'?after.status==='active'&&after.stageId===item.before.stageId:after.status==='active'&&after.stageId===item.targetStageId;
}
export async function prepareItem(api:Harvest,applicationId:string,action:Action,choice?:string,signal?:AbortSignal):Promise<LiveItem> {
 const a=await api.application(applicationId,signal), before=snapshot(a); if(before.applicationId!==applicationId)throw Error('Application response mismatch');
 if(action==='unreject'?before.status!=='rejected':before.status!=='active') throw Error('Action is not valid for the application status');
 const item:LiveItem={before,action,label:`Candidate ${before.candidateId} · ${a.jobs[0].name} · ${a.current_stage.name}`};
 if(action==='reject') {
  const reasons=await api.list('/rejection_reasons',signal); const reason=reasons.find(r=>String(r.id)===numericId(choice)); if(!reason)throw Error('Choose an available Greenhouse rejection reason'); item.reasonId=String(reason.id);item.reasonLabel=reason.name;
 } else if(action==='advance'||action==='move') {
  const stages=await api.stages(before.jobId,signal); const sorted=stages.slice().sort((a,b)=>a.priority-b.priority);
  const at=sorted.findIndex(s=>String(s.id)===before.stageId);
  if(at<0||sorted.some(s=>!Number.isFinite(s.priority))||new Set(sorted.map(s=>s.priority)).size!==sorted.length)throw Error('Stage ordering is ambiguous');
  const target=action==='advance'?sorted[at+1]:sorted.find(s=>String(s.id)===numericId(choice));
  if(!target||String(target.id)===before.stageId)throw Error('No valid destination stage'); item.targetStageId=numericId(target.id);item.targetLabel=target.name;
 }
 actionBody(item);return item;
}
/** Intent is persisted BEFORE sending; a crash/unknown intent blocks any automatic replay. */
export async function executeLivePlan(api:Harvest,plan:LivePlan,count:number,save:(r:LiveReceipt)=>Promise<void>,blocked:(id:string,planId?:string)=>Promise<boolean>,signal?:AbortSignal) {
 if(!Array.isArray(plan?.items)||count!==plan.items.length||!count||count>1000||plan.actor!==api.actor||!Number.isSafeInteger(plan.createdAt)||plan.createdAt>Date.now()||Date.now()-plan.createdAt>300000||typeof plan.id!=='string'||!plan.id.trim()||plan.id.length>200)throw Error('Plan expired or confirmation count/actor mismatch');
 const immutable:LivePlan=JSON.parse(JSON.stringify(plan)); const seen=new Set<string>();
 for(const i of immutable.items){const id=numericId(i.before.applicationId);if(seen.has(id))throw Error('Duplicate application');seen.add(id);actionBody(i);if(i.evidence&&(!/^[a-f0-9]{64}$/i.test(i.evidence.sourceSha256)||!i.evidence.engineVersion||!i.evidence.criteria||!Number.isFinite(Date.parse(i.evidence.analyzedAt))))throw Error('Invalid evidence binding');}
 const results:LiveReceipt[]=[]; let stop=false;
 for(const item of immutable.items) {
  const request={method:'POST' as const,path:actionPath(item),body:actionBody(item)};
  const base={planId:immutable.id,actor:immutable.actor,applicationId:item.before.applicationId,action:item.action,before:item.before,request,evidence:item.evidence?{...item.evidence}:undefined};
  let r:LiveReceipt={...base,status:'skipped',at:new Date().toISOString()};
  if(signal?.aborted||stop){r.status='cancelled';r.detail='Not attempted';await save(r);results.push(r);continue;}
  try {
   if(await blocked(item.before.applicationId,immutable.id))throw Error('Prior attempt requires receipt review; no automatic replay');
   const fresh=await prepareItem(api,item.before.applicationId,item.action,item.reasonId??(item.action==='move'?item.targetStageId:undefined),signal);
   const {evidence:_localEvidence,...freshState}=fresh; const {evidence:_plannedEvidence,...plannedState}=item;
   if(JSON.stringify(freshState)!==JSON.stringify(plannedState))throw Error('Application, reason or stage changed since preview');
   if(signal?.aborted){r.status='cancelled';r.detail='Not attempted';stop=true;} else {
    await save({...base,status:'started',at:new Date().toISOString()});
    if(signal?.aborted){r.status='cancelled';r.detail='Not attempted';stop=true;}
    else {
     let dispatched=false;
     try {
      const {response}=await api.request(request.path,request.method,request.body); dispatched=true;
      if(response.status!==204){r.status='unknown';r.detail='Unexpected mutation response; reconcile in Greenhouse before retry';}
      else {
       const after=snapshot(await api.application(item.before.applicationId));r.after=after;r.status=reached(item,after)?'succeeded':'unknown';
       if(r.status==='unknown')r.detail='Greenhouse state does not match the requested action; reconcile before retry';
      }
     } catch(e) {r.status=dispatched||!(e instanceof HarvestError)||e.uncertain?'unknown':'failed';r.detail=e instanceof Error?e.message:'Write outcome unknown';}
    }
   }
  }catch(e){r.status=signal?.aborted||e instanceof DOMException&&e.name==='AbortError'?'cancelled':'skipped';r.detail=e instanceof Error?e.message:'Preflight failed';stop=true;}
  r.at=new Date().toISOString();await save(r);results.push(r);
  if(r.status==='unknown'||r.status==='failed')stop=true;
 }
 return results;
}
export function attachmentURL(raw:string):string {
 const u=new URL(raw);
 const hosts=new Set(['grnhse-dochouse-prod.s3.amazonaws.com','grnhse-dochouse-prod.s3.us-east-1.amazonaws.com','grnhse-dochouse-prod-eu.s3.eu-central-1.amazonaws.com']);
 if(u.protocol!=='https:'||u.port||u.username||u.password||!hosts.has(u.hostname))throw Error('Attachment host not approved; download in Greenhouse and import locally'); return u.href;
}
export async function downloadAttachment(raw:string,transport:typeof fetch=fetch) {
 const r=await transport(attachmentURL(raw),{credentials:'omit',redirect:'error',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(25000)});
 if(!r.ok)throw new HarvestError(r.status);return boundedBytes(r);
}
