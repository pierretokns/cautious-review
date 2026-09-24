import type {CandidateDocument} from './core.js';
import {conceptSearch} from './evidence.js';
export const MODEL='Xenova/all-MiniLM-L6-v2@751bff37182d3f1213fa05d7196b954e230abad9:q8';
let extractor:Promise<any>|undefined;
const cachedVectors=new Map<string,number[]>();
export function clearSemanticCache(){cachedVectors.clear();}
async function embed(pipe:any,text:string):Promise<number[]>{
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 const key=MODEL+':'+[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
 const existing=cachedVectors.get(key);if(existing)return existing;
 const vector=(await pipe(text,{pooling:'mean',normalize:true})).tolist()[0] as number[];
 if(cachedVectors.size>=5000)cachedVectors.delete(cachedVectors.keys().next().value!);
 cachedVectors.set(key,vector);return vector;
}
async function model(){return extractor??=(async()=>{
 // @ts-ignore packaged browser distribution, Apache-2.0
 const {env,pipeline}=await import('./vendor/transformers.min.js');
 env.allowRemoteModels=false;env.allowLocalModels=true;env.useBrowserCache=false;
 env.localModelPath=new URL('./models/',import.meta.url).href;
 env.backends.onnx.wasm.wasmPaths=new URL('./vendor/',import.meta.url).href;
 env.backends.onnx.wasm.numThreads=1;env.backends.onnx.wasm.proxy=false;
 return pipeline('feature-extraction','minilm',{device:'wasm',dtype:'q8',local_files_only:true});
 })().catch(e=>{extractor=undefined;throw e;});}
export function passages(text:string){const result:{start:number;end:number;quote:string}[]=[];for(let start=0;start<text.length;start+=600){const end=Math.min(text.length,start+800);result.push({start,end,quote:text.slice(start,end)});if(end===text.length)break;}return result;}
export function cosine(a:number[],b:number[]){if(a.length!==b.length||!a.length)throw Error('Invalid embedding dimensions');const dot=a.reduce((s,v,i)=>s+v*b[i],0);return dot/(Math.hypot(...a)*Math.hypot(...b)||1);}
/** Reciprocal rank fusion retrieves exact passages. It never returns dispositions or a fit score. */
export async function hybridSearch(query:string,docs:CandidateDocument[],progress:(text:string)=>void=()=>{}){
 if(!query.trim())return [];if(docs.length>1000)throw Error('Select a smaller local corpus (maximum 1,000 résumés)');
 const pipe=await model();const vector=await embed(pipe,query);
 const lexical=conceptSearch(query,docs);const semantic=[];
 let count=0;
 for(const document of docs){let best:{score:number;passage:{start:number;end:number;quote:string}}|undefined;
 for(const passage of passages(document.text)){const embedding=await embed(pipe,passage.quote);const score=cosine(vector,embedding);if(!best||score>best.score)best={score,passage};}
 if(best)semantic.push({document,...best});progress(`Locally searched ${++count}/${docs.length} résumés`);
 }
 semantic.sort((a,b)=>b.score-a.score||a.document.key.localeCompare(b.document.key));
 return semantic.map((hit,i)=>{const lex=lexical.findIndex(h=>h.document.key===hit.document.key);return {...hit,rank:1/(60+i+1)+(lex>=0?1/(60+lex+1):0),model:MODEL};}).sort((a,b)=>b.rank-a.rank).slice(0,20);
}
