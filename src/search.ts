import type { CandidateDocument } from "./storage";
const STOP=new Set(["the","and","or","a","an","to","of","in","for","with","on","at","by","is","are"]);
export function tokens(s:string){return s.toLowerCase().replace(/[^a-z0-9+#.\- ]/g," ").split(/\s+/).filter(x=>x.length>1&&!STOP.has(x))}
export interface SearchHit{candidate:CandidateDocument;score:number;evidence:string[]}
export function lexicalSearch(query:string,docs:CandidateDocument[]):SearchHit[]{const q=[...new Set(tokens(query))];if(!q.length)return[];return docs.map(candidate=>{const text=candidate.text.toLowerCase();const matched=q.filter(t=>text.includes(t));const score=matched.length/q.length;const evidence=matched.slice(0,8).map(t=>{const i=text.indexOf(t),start=Math.max(0,i-80),end=Math.min(candidate.text.length,i+t.length+120);return candidate.text.slice(start,end).replace(/\s+/g," ").trim()});return{candidate,score,evidence}}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score)}
