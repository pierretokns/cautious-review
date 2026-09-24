# Verified prior art and reuse

## open-greenhouse-mcp — actual MIT adaptation

Source: https://github.com/benmonopoli/open-greenhouse-mcp

`src/batch.ts` adapts the sequential bulk-operation/result-accounting pattern from `src/greenhouse_mcp/harvest/batch.py`, blob `c0523a6881d82ccc739cd98b97fc69a47dea75d9`. The original is Python; this adapter-neutral TypeScript implementation adds full validation, immutable plan snapshots, explicit reviewed/count confirmation, expected stages, stale-state preflight, cancellation, durable receipts and stop-on-unknown semantics. No live API transport is attached yet.

Copyright (c) 2026 Ben Monopoli. The MIT notice and source reference are preserved in `third_party/THIRD_PARTY_NOTICES.txt` and shipped in the extension archive. The upstream fixed 250 ms pause is not treated as a universal rate limit; a future transport must respect observed rate-limit headers.

## GreenMaxing — inspectable artifact, not copied source

Chrome Web Store ID: `npplpgbebfjnhmnaehlbhiohclhfgcml`.

The public interaction concepts informed keyboard review and explicit bulk confirmation. No proprietary code is copied. `scripts/audit-greenmaxing.mjs --download` requests the public signed CRX, verifies developer identity/signatures, inventories manifest permissions/files and scans static network/dynamic-code indicators. It never executes the extension, accesses Greenhouse, or uses applicant data.

CI publishes the JSON static report separately. Failed download/verification is recorded as blocked, not an audit pass. A successful static scan is not a dynamic security audit or corporate approval. The proprietary CRX/source is not redistributed and temporary package files are removed.

## Not claimed as reused

The Searches implementation was not located. ApplyVerse, Autograph, Emplorio and other previously discussed projects have not been incorporated into this release. The local evidence rules are new code, not a claimed port of an uninspected fit engine.

Before future code adoption: record source revision, license, copied/adapted files and behavior differences, then include required notices in release artifacts.
