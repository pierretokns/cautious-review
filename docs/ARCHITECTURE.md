# Architecture

## Current data flow

1. Greenhouse remains the system of record.
2. The content script exposes a Shadow DOM review panel only on validated Greenhouse application/candidate URLs.
3. Candidate résumé text is indexed only after explicit selection/paste or reviewed local JSON import. There is no automatic page scraping in 0.2.0.
4. The extension service worker owns IndexedDB, keeping cached applicant text and review state out of the Greenhouse page origin.
5. Retrieval and criteria analysis run locally and return exact supporting text/source offsets.
6. Reviewer dispositions are queued locally with transactional undo/audit history.
7. No runtime network primitive or live Greenhouse write adapter is shipped yet.

## Evidence model

Evidence is deliberately not a candidate score. For each reviewer-entered job criterion the local engine reports one of:

- `not_established` — no supported text found; absence is not treated as proof of lack of skill.
- `mention` — terminology appears without a configured work-action signal.
- `work_claim` — résumé text contains a self-reported work claim around the criterion.
- `possible_negation` — nearby language may negate or conflict with the criterion and requires review.

Every positive/uncertain result preserves the original quote, match alias and source offsets.

## Readability diagnostics

Text diagnostics are a separate channel from capability evidence. They can flag extraction duplication, extreme bullet length/count, invisible Unicode, and decoding corruption. They never alter retrieval order or disposition. Visual typography requires future document/PDF layout extraction and must remain separately labeled.

## Future local semantic retrieval

Issue #1 tracks an optional `Embedder` boundary for tiny browser-local WASM/WebGPU models. Prior art such as SemanticFinder demonstrates feasibility, but model acquisition/caching, deterministic versioning, memory limits, CSP, offline behavior and evidence mapping must be resolved before adding it. Core review must continue to work without a model.

## Future Greenhouse writes

`src/batch.ts` contains a disconnected reviewed-batch execution core. A live adapter must provide per-item preflight, apply, durable receipt recording and rate-limit pacing. It may execute explicit reviewer decisions; it must not translate retrieval/model scores into automatic dispositions. Unknown write outcomes stop execution until server state is reconciled.
