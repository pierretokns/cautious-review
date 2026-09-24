# Verification record — 0.2.0

- TypeScript 5.8.3 build: PASS in development.
- Node 22.16.0: 66 unit tests PASS in development, including identity validation, evidence, import, batch safety and CRX tests.
- ZIP: integrity checked by unzip; SHA-256 supplied.
- CRX3: RSA signature and declared developer-ID verification, tampering/truncation tests and exact ZIP-payload comparison. Self-signed preview identity; NOT Web Store signed or proof of unrestricted installation.
- Local browser fixture: BLOCKED before navigation by ERR_BLOCKED_BY_ADMINISTRATOR. No browser policy was modified or bypassed.
- CI: unit/browser jobs run in parallel with packaging. Releases are gated on success; inspect the corresponding commit's Actions run for actual results. A pending run is not a pass.
- GreenMaxing: separate static-download/audit job and JSON report. Success is not corporate security approval; failures are reported as blocked.
- Live Greenhouse DOM/account/API integration, production hiring behavior and neural embeddings are not validated or implemented as applicable. No live Greenhouse writes occur.

Synthetic local retrieval check: 900 documents × 1,500 characters, three query terms, 20 hits in about 56 ms on the development host. One synthetic observation, not a browser or production guarantee.

Do not describe this preview as production-ready or a finished bulk-rejection integration.
