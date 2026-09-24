# Verification record

## 0.3.3 preview candidate

- `npm test` passed all 181 unit tests.
- Synthetic browser workflows passed 108 checks: 32 base, 23 Live Review, 31 browser-session diagnostics, and 22 page-linked résumé reader checks, using Chromium 145.0.7632.6. The fixtures use synthetic pages, records, and documents; no real Greenhouse account was used. Reader checks include SPA navigation identity validation, an `app15` page, a long signed URL, and offline bundled WASM inference.
- ZIP/CRX packaging checks passed, including archive integrity, CRX signature and exact ZIP payload, and pinned model hash verification.

These results do not establish compatibility with a live Greenhouse account, attachment ownership by a particular application, production hiring behavior, résumé quality, model suitability, or account permissions. The page-linked résumé preview route was identified from public source evidence and has not been validated against an authenticated account. The 0.3.3 release candidate still requires verification by its exact-commit CI and published-artifact checks.

## 0.3.2 preview candidate

- `npm test` passed all 165 unit tests.
- Synthetic browser workflows passed 102 checks: 32 base, 23 Live Review, 31 browser-session diagnostics, and 16 page-linked résumé reader checks. These fixtures use synthetic pages, applications, and documents. They do not establish real-account compatibility. The résumé reader checks include offline bundled WASM inference; no real Greenhouse account was used.
- ZIP/CRX package integrity, CRX signature and exact ZIP payload, and pinned model hash checks passed.
- After this local verification, the final source update added expired-record cleanup when the résumé reader loads or searches. The final CI run must verify this exact source revision before release.

These checks do not establish compatibility with a live Greenhouse account, attachment ownership by a particular application, production hiring behavior, résumé quality, model suitability, or account permissions. The page-linked résumé preview route was identified from public source evidence and has not been validated against the user's authenticated account.

## 0.3.1 preview candidate

- `npm test` passes all 152 unit tests.
- Synthetic browser workflows pass 32 base checks, 23 Live Review checks, and 31 browser-session diagnostics checks (86 total). Diagnostics checks include trusted-click startup, forged-start rejection, unchanged native network results, value-free export, stop/clear, and the 100-observation and ten-minute limits. These browser tests use synthetic pages and intercepted requests, not a real Greenhouse session.
- Packaging checks pass for ZIP integrity, the CRX signature and exact ZIP payload, and the pinned model hash. The package includes the model license and bundled-library notices.
- The CRX is self-signed with an ephemeral identity, not Web Store signed. The Harvest token helper is distributed separately from the extension ZIP and CRX.

These checks do not establish real Greenhouse account compatibility, production hiring behavior, résumé quality, model suitability, or account permissions. No real Greenhouse end-to-end validation was performed. The diagnostics observe normal session traffic but do not implement direct session-backed reads or actions. Do not describe this preview as production-ready or as an autonomous employment decision system.

## Published 0.3.0 preview

The published preview was built from commit `547bd45f035fcc055061e319225f00cfa0eba9af` ([release](https://github.com/pierretokns/cautious-review/releases/tag/preview-547bd45f035f), [workflow](https://github.com/pierretokns/cautious-review/actions/runs/36004341428)). Its verified scope was:

- `npm test` rebuilt the extension and passed all 143 unit tests.
- Synthetic browser workflows passed 32 base checks and 23 Live Review checks (55 total) using Chromium 145.0.7632.6. The fixture intercepts Harvest and storage requests with synthetic data. It exercises PDF extraction, offline bundled WASM inference, reviewed writes, read-after-write reconciliation, rejection-reason confirmation, and unknown-write handling.
- Published ZIP integrity passed; the CRX signature and exact ZIP payload were verified; the model file hash matched `third_party/MODEL.json`; all entries in `SHA256SUMS` verified. The package inventory includes the model Apache-2.0 text and separate bundled-library license notices. `BUILD.json` names the same commit.

These results do not establish real Greenhouse account compatibility or production hiring behavior. Use the exact release's `BUILD.json` and `SHA256SUMS` for its artifact hashes.
