/** Sequential bulk-result accounting adapted from open-greenhouse-mcp batch.py.
 * Copyright (c) 2026 Ben Monopoli. MIT; see THIRD_PARTY_NOTICES.txt in the build.
 * Source blob: c0523a6881d82ccc739cd98b97fc69a47dea75d9.
 * Adds full prevalidation, stale-state checks, cancellation, and no blind write retries.
 * NOT connected to a live Greenhouse adapter in this preview.
 */
export interface ReviewedAction { applicationId: string; action: 'reject' | 'advance'; rejectionReasonId?: string; fromStageId?: string; sendEmail?: false }
export interface BatchReceipt { applicationId: string; status: 'succeeded' | 'skipped' | 'failed' | 'unknown'; detail?: string }
export interface ReviewedPlan { batchId: string; reviewed: true; confirmCount: number; items: ReviewedAction[] }
export interface BatchAdapter {
 preflight(item: ReviewedAction, operationId: string): Promise<'ready' | 'changed' | 'already-applied'>;
 apply(item: ReviewedAction, operationId: string): Promise<'succeeded' | 'failed' | 'unknown'>;
 record(receipt: BatchReceipt, operationId: string): Promise<void>;
 pause(): Promise<void>; // Implement from actual rate-limit headers; not an assumed global quota.
}
export async function executeReviewedBatch(plan: ReviewedPlan, adapter: BatchAdapter, signal?: AbortSignal) {
 const id = (s: unknown) => typeof s === 'string' && /^[1-9]\d*$/.test(s);
 if (plan.reviewed !== true || !/^[a-zA-Z0-9_-]{8,100}$/.test(plan.batchId) || !Array.isArray(plan.items) || !plan.items.length || plan.items.length > 1000 || plan.confirmCount !== plan.items.length) throw Error('Explicit reviewed plan and matching count required');
 const items = plan.items.map(item => Object.freeze({ ...item }));
 const seen = new Set<string>();
 for (const item of items) {
  if (!id(item.applicationId) || seen.has(item.applicationId)) throw Error('Invalid or duplicate application ID'); seen.add(item.applicationId);
  if (item.sendEmail !== undefined && item.sendEmail !== false) throw Error('Email requires a separate reviewed workflow');
  if (item.action === 'reject' ? !id(item.rejectionReasonId) : item.action === 'advance' ? !id(item.fromStageId) : true) throw Error('Reject requires a mapped reason; advance requires the expected stage');
 }
 const receipts: BatchReceipt[] = [];
 for (const item of items) {
  if (signal?.aborted) break;
  const operationId = `${plan.batchId}:${item.applicationId}:${item.action}`;
  let state: 'ready' | 'changed' | 'already-applied';
  try { state = await adapter.preflight(item, operationId); }
  catch { const r: BatchReceipt = { applicationId: item.applicationId, status: 'failed', detail: 'Preflight failed; no write attempted. Batch stopped.' }; await adapter.record(r, operationId); receipts.push(r); break; }
  if (signal?.aborted) break;
  let receipt: BatchReceipt;
  if (state !== 'ready') receipt = { applicationId: item.applicationId, status: 'skipped', detail: state };
  else {
   let status: BatchReceipt['status'];
   try { const result = await adapter.apply(item, operationId); status = ['succeeded', 'failed', 'unknown'].includes(result) ? result : 'unknown'; } catch { status = 'unknown'; }
   receipt = { applicationId: item.applicationId, status, ...(status === 'unknown' ? { detail: 'Reconcile server state before any retry; batch stopped.' } : {}) };
  }
  // Persist before progressing. A failed durable receipt must stop the batch.
  await adapter.record(receipt, operationId); receipts.push(receipt);
  if (receipt.status === 'unknown') break;
  await adapter.pause();
 }
 return { total: items.length, processed: receipts.length, succeeded: receipts.filter(r => r.status === 'succeeded').length, failed: receipts.filter(r => r.status === 'failed').length, unknown: receipts.filter(r => r.status === 'unknown').length, receipts };
}
