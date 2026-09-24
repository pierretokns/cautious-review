# Cautious Review

Local-first, keyboard-first Greenhouse review. **0.1.1 is an early local-only preview, not a complete recruiting system.**

## Download and try — no npm needed

[Download the 0.1.1 preview ZIP](downloads/cautious-review-0.1.1.zip) and [SHA-256 checksum](downloads/SHA256SUMS).
Extract it. In desktop Chrome open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the extracted directory containing `manifest.json`. Then reload a Greenhouse job-application page and enable keyboard review in the overlay. Corporate browser policy may restrict unpacked extensions.

The checked-in ZIP passed TypeScript compilation, 23 unit tests and archive integrity checks. Browser navigation was blocked by the development sandbox; do not treat this ZIP as browser/integration-certified. The push workflow publishes separate commit-specific prereleases only after its browser-fixture test also passes. Check the Actions result rather than assuming it passed.

## What works in this preview

- Opt-in keyboard queue: A advance, M maybe, R reject with a chosen reason, 1–7 reason shortcuts, U restores the previous local decision.
- Application-scoped keys prevent two applications for one candidate from overwriting each other.
- Shortcuts ignore text inputs, contenteditable fields, modifier chords, repeated/composing keystrokes, and visible dialogs.
- J/K follows only an unambiguous, visible next/previous-candidate link.
- Explicitly index selected/pasted résumé text. Exact-token local search shows source evidence and query-term coverage, not a hiring score. Repeating a keyword does not improve coverage.
- IndexedDB lives in the extension service worker, not the Greenhouse page origin. Local clear-all and seven-day expiry are included.
- Local decision queue with transactional undo history. **No rejection, advancement, email, or other write is sent to Greenhouse.**

## Still missing

Greenhouse write adapter, automatic embedded-PDF extraction, corpus sync, semantic embeddings, job-fit evidence engine, readability diagnostics, account/tenant isolation, comprehensive audit export, and real Greenhouse integration validation. A local preview is not a production data-processing approval.

The GreenMaxing CRX and earlier proposed OSS business logic have **not** been audited or copied into this increment. Track those separately; preserve licenses when adopting code.

## Development

```sh
npm ci --ignore-scripts
npm test
npm run package
# Browser fixtures use an isolated extension copy and loopback HTTP only:
uv run --with playwright==1.57.0 playwright install chromium
uv run --with playwright==1.57.0 python tests/browser_smoke.py
```

Node 22+, TypeScript 5.8.3, and OS `zip`/`unzip` are required to build/package. There are no runtime npm dependencies. The compiler is locked with npm registry integrity metadata. Content script is emitted as a classic script; the worker uses ES modules. No Vite bundler is needed.

Build/test/release runs on each push to main, not on an hourly timer. This is CI, **not** an autonomous coding agent.

See [architecture](docs/ARCHITECTURE.md), [privacy](docs/PRIVACY.md), [employment safeguards](docs/EMPLOYMENT-SAFETY.md), and [build status](docs/BUILD-STATUS.md).
