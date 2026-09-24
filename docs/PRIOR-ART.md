# Prior art and reuse record

Cautious Review checks prior art before adding substantial functionality and distinguishes **ideas observed publicly** from **code actually reused**.

## GreenMaxing Toolbar — interaction audit only

Public listing: https://chromewebstore.google.com/detail/greenmaxing-toolbar/npplpgbebfjnhmnaehlbhiohclhfgcml

As of 2026-09-24, the public Chrome Web Store listing reports version 6.2.1, updated 2026-08-26. Useful interaction ideas visible in that listing include a docked Greenhouse review panel, keyboard actions that do not fire while typing, local-by-default state, explicit opt-in before live bulk actions, count confirmation for each run, review-before-send email behavior, and skipping uncertain records instead of guessing.

**No proprietary GreenMaxing code has been copied.** The current execution environment could not retrieve its CRX bytes from Google's update endpoint, so source/manifest/network claims are not marked complete. `scripts/audit-greenmaxing.mjs` can inspect a locally supplied signed CRX, verify the declared extension ID/signature, inventory permissions/files, and report static network/dynamic-code indicators without executing or redistributing proprietary code.

One GreenMaxing feature described publicly uses indirect geographic signals such as employer/school/phone country information for recruiter tagging. Cautious Review intentionally does **not** reuse that behavior for employment decisions or work-authorization inference.

## open-greenhouse-mcp — MIT code adapted

Repository: https://github.com/benmonopoli/open-greenhouse-mcp

The future reviewed-batch execution core in `src/batch.ts` adapts the sequential bulk-operation/result-accounting pattern from `src/greenhouse_mcp/harvest/batch.py`, source blob `c0523a6881d82ccc739cd98b97fc69a47dea75d9`. Cautious Review adds full prevalidation before writes, explicit reviewed/count confirmation, expected-stage checks, stale-state preflight, cancellation, durable receipts, and a stop-on-unknown rule that forbids blind retries. The MIT copyright/license and source reference ship in `THIRD_PARTY_NOTICES.txt`.

The upstream project's fixed 250 ms delay is **not** copied as a universal rate limit; the adapter interface requires rate-limit behavior to come from actual observed headers/Greenhouse behavior.

## SemanticFinder — MIT architecture reference, no code copied

Repository: https://github.com/do-me/SemanticFinder

SemanticFinder demonstrates frontend-only semantic retrieval using Transformers.js with WASM/WebGPU and hybrid semantic/full-text search. This validates the architecture direction for issue #1. No SemanticFinder source is vendored in 0.2.0; Cautious Review currently keeps `connect-src 'none'` and has no runtime model dependency.

## Adoption rule

Before code is copied or substantially adapted, record the upstream repository, exact revision/blob where practical, license, copied/adapted files, and behavioral differences. Preserve required notices in release artifacts.
