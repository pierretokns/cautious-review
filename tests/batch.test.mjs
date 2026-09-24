import {test} from 'node:test';import assert from 'node:assert/strict';import {executeReviewedBatch} from '../dist/batch.js';
const items=[{applicationId:'1',action:'reject',rejectionReasonId:'9'},{applicationId:'2',action:'advance',fromStageId:'3'}];
const plan=(overrides={})=>({batchId:'reviewed_batch_1',reviewed:true,confirmCount:2,items,...overrides});
function fake(overrides={}){const calls=[];return {calls,preflight:async()=> 'ready',apply:async i=>{calls.push(i.applicationId);return 'succeeded'},record:async()=>{},pause:async()=>{},...overrides};}
test('reviewed batch executes sequentially',async()=>{const a=fake();const r=await executeReviewedBatch(plan(),a);assert.equal(r.succeeded,2);assert.deepEqual(a.calls,['1','2'])});
test('count mismatch causes zero writes',async()=>{const a=fake();await assert.rejects(executeReviewedBatch(plan({confirmCount:1}),a));assert.equal(a.calls.length,0)});
test('duplicates cause zero writes',async()=>{const a=fake();await assert.rejects(executeReviewedBatch(plan({items:[items[0],items[0]]}),a));assert.equal(a.calls.length,0)});
test('unreviewed plan rejected',async()=>await assert.rejects(executeReviewedBatch(plan({reviewed:false}),fake())));
test('advance must name original stage',async()=>await assert.rejects(executeReviewedBatch(plan({items:[items[0],{applicationId:'2',action:'advance'}]}),fake())));
test('stale application skipped',async()=>{const a=fake({preflight:async()=> 'changed'});const r=await executeReviewedBatch(plan(),a);assert.equal(a.calls.length,0);assert.equal(r.receipts[0].status,'skipped')});
test('ambiguous write result stops instead of retrying',async()=>{const a=fake({apply:async()=>{throw Error('timeout')}});const r=await executeReviewedBatch(plan(),a);assert.equal(r.processed,1);assert.equal(r.unknown,1)});
test('cancellation prevents writes',async()=>{const c=new AbortController();c.abort();const a=fake();await executeReviewedBatch(plan(),a,c.signal);assert.equal(a.calls.length,0)});
test('receipt failure stops before next action',async()=>{const a=fake({record:async()=>{throw Error('disk full')}});await assert.rejects(executeReviewedBatch(plan(),a));assert.deepEqual(a.calls,['1'])});
test('cannot smuggle unreviewed email sending',async()=>await assert.rejects(executeReviewedBatch(plan({items:[{...items[0],sendEmail:true},items[1]]}),fake())));
test('caller cannot mutate approved plan during preflight',async()=>{const p=structuredClone(plan());const applied=[];const a=fake({preflight:async()=>{p.items[0].action='advance';return 'ready'},apply:async item=>{applied.push(item.action);return 'succeeded'}});await executeReviewedBatch(p,a);assert.deepEqual(applied,['reject','advance'])});
