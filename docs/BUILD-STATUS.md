# Verification record — 0.2.0

- TypeScript 5.8.3 build: PASS in development.
- Node 22.16.0: 66 unit tests PASS in development, including the existing identity/keyboard-domain tests and new evidence, import, batch-safety and CRX tests.
- ZIP: integrity checked by unzip; SHA-256 supplied.
- CRX3: actual RSA signature and declared developer-ID verification, tampering/truncation tests, exact ZIP-payload comparison. Self-signed preview identity; NOT Chrome Web Store signed or proof of unrestricted installation.
- Local browser fixture: BLOCKED before navigation by ERR_BLOCKED_BY_ADMINISTRATOR. No browser policy was modified or bypassed.
- CI: unit, synthetic-browser, and packaging jobs run independently. Releases are gated on all three; see the matching commit's Actions run for actual results. Do not assume a pending run passed.
- Third-party GreenMaxing inspection: `npm run audit:greenmaxing -- <path.crx>` is a static developer tool, not a release gate. The current environment could not retrieve the proprietary CRX from Google, so the actual package audit remains incomplete.
- Live Greenhouse DOM/account/API integration, production hiring behavior and neural embeddings: NOT validated or implemented as applicable. No live Greenhouse writes occur.

Synthetic local retrieval check: 900 documents × 1,500 characters, three query terms, returned 20 hits in about 56 ms on the development host. This is one synthetic observation, not a browser or production performance guarantee.

Do not describe this preview as production-ready or a finished bulk-rejection integration.
