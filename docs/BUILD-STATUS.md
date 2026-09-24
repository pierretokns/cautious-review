# Verification record — 0.3.0 preview

Local verification for the current 0.3.0 working tree:

- `npm test` rebuilt the extension and passed all 143 unit tests.
- Synthetic browser workflows passed 31 base checks and 23 Live Review checks using Chromium 145.0.7632.6. The fixture intercepts Harvest and storage requests with synthetic data. It exercises PDF extraction, offline bundled WASM inference, reviewed writes, read-after-write reconciliation, rejection-reason confirmation, and unknown-write handling.
- `npm run package` created the ZIP, CRX, and standalone token helper. ZIP integrity passed; the CRX signature and exact ZIP payload were verified; the model file hash matched `third_party/MODEL.json`; all entries in `SHA256SUMS` verified. The package inventory includes the model Apache-2.0 text and separate bundled-library license notices.
- The CRX is self-signed with an ephemeral identity, not Web Store signed. The token helper is distributed separately from the extension ZIP and CRX.

These results do not establish real Greenhouse account compatibility, production hiring behavior, résumé quality, model suitability, or account permissions. No real Greenhouse end-to-end validation was performed. Do not describe this preview as production-ready or as an autonomous employment decision system. Use the exact release's `BUILD.json` and `SHA256SUMS` for its commit and artifact hashes; this local verification has no release URL.
