# Verification record — 0.1.1

- TypeScript 5.8.3 compilation: PASS.
- Node 22.16.0: 23 unit tests PASS (identity parsing, ambiguous URLs, application collisions, exact-token search, keyword repetition, Unicode, rejection reason validation).
- ZIP integrity: checked with unzip -t; SHA-256 accompanies the archive.
- Full browser fixture: NOT completed in the development sandbox. Chromium returned ERR_BLOCKED_BY_ADMINISTRATOR for both intercepted external navigation and loopback fixture navigation. No browser policy was modified or bypassed.
- CI includes an offline, synthetic loopback browser fixture using an isolated test-only extension copy. The temporary copy changes host validation only to permit loopback; production host rules are tested independently. Production dist is not modified by this test.
- Real Greenhouse login, DOM, authorization, APIs and write operations: NOT tested. No live writes are implemented.
- CRX signing and Web Store publication: NOT implemented. The ZIP is a real unpacked Chrome extension, not a renamed/fake CRX.

Do not describe this release as production-ready, fully integrated or end-to-end verified. Do not mark prior-art audits complete merely because they have been discussed.
