import { HOSTS } from './core.js';
import { numericId, snapshot, type Harvest } from './harvest.js';
export interface IdentityHints {origin:string;applicationId?:string;candidateId?:string;jobId?:string;stageId?:string}
/** Only route facts and explicitly supplied adapter facts. Review path numbers are NOT guessed to be application IDs. */
export function routeIdentity(raw:string, facts:Partial<IdentityHints>[]=[]):IdentityHints {
 const u=new URL(raw); if(u.protocol!=='https:'||!HOSTS.has(u.hostname)||u.port||u.username||u.password)throw Error('Unsupported Greenhouse origin');
 // Keep identity extraction on the two record routes and the two Greenhouse
 // review surfaces we support. In particular, a number in a review/list URL
 // is never treated as an application ID by position.
 const record=u.pathname.match(/^\/(people|candidates)\/([1-9]\d*)(?:\/|$)/);
 const application=u.pathname.match(/^\/applications\/([1-9]\d*)(?:\/|$)/);
 const review=/^\/applications\/review(?:\/[^/]+)*(?:\/)?$/.test(u.pathname);
 const planCandidates=/^\/plans\/[^/]+\/candidates(?:\/[^/]+)*(?:\/)?$/.test(u.pathname);
 if(!record&&!application&&!review&&!planCandidates)throw Error('Unsupported Greenhouse route');
 const values:Record<string,string[]>={applicationId:[],candidateId:[],jobId:[],stageId:[]};
 const add=(k:string,v:unknown)=>{if(v!==undefined)values[k].push(numericId(v));};
 if(record)add('candidateId',record[2]);
 if(application)add('applicationId',application[1]);
 for(const [key,names] of Object.entries({applicationId:['application_id','job_application_id'],candidateId:['candidate_id','person_id'],jobId:['job_id'],stageId:['stage_id']}))for(const n of names)for(const v of u.searchParams.getAll(n))add(key,v);
 for(const f of facts)for(const k of Object.keys(values))add(k,(f as any)[k]);
 const result:IdentityHints={origin:u.origin};
 for(const [k,v]of Object.entries(values)){if(new Set(v).size>1)throw Error('Ambiguous Greenhouse identity');if(v.length)(result as any)[k]=v[0];}return result;
}
export async function resolveIdentity(api:Harvest,h:IdentityHints) {
 for(const k of ['applicationId','candidateId','jobId','stageId'] as const)if(h[k]!==undefined)numericId(h[k]);
 let a;
 if(h.applicationId)a=await api.application(h.applicationId);
 else if(h.candidateId){const q=new URLSearchParams({candidate_ids:numericId(h.candidateId),per_page:'100'});if(h.jobId)q.set('job_ids',numericId(h.jobId));const list=await api.list('/applications?'+q.toString());const matches=list.filter(a=>String(a.candidate_id)===h.candidateId&&(!h.jobId||String(a.job_id)===h.jobId));if(matches.length!==1)throw Error('Multiple applications: select the exact application in Live Review');a=await api.application(numericId(matches[0].id));}
 else throw Error('No selected application. Choose a job and application in Live Review');
 const s=snapshot(a);for(const k of ['applicationId','candidateId','jobId','stageId'] as const)if(h[k]&&h[k]!==s[k])throw Error('Route and Harvest identity disagree');return a;
}
