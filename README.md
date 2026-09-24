# Cautious Review

Local-first, keyboard-first Greenhouse review. **0.2.0 is a local evidence/queue preview, not a complete ATS replacement. It does not execute live Greenhouse rejections.**

## Download and test — no npm needed

Get the ZIP from the [newest successful preview release](https://github.com/pierretokns/cautious-review/releases). Every new release is gated on unit, browser-fixture and artifact checks. The older checked-in 0.1.1 ZIP remains an archived preview; prefer Releases.

Extract the ZIP. Open `chrome://extensions` in desktop Chrome, enable Developer mode, choose **Load unpacked**, select the folder containing `manifest.json`, and reload a Greenhouse application page. Corporate browser policy may restrict unpacked installations.

A genuine signed CRX3 is also attached, but it is a **self-signed preview**, not Web Store signed. Its ephemeral signing identity changes each build and does not provide an update channel. Ordinary Mac/Windows users should use the ZIP/unpacked path. `SHA256SUMS` and `BUILD.json` describe the exact artifacts.

## What works

Opt-in A/M/R review, numbered rejection reasons, transactional undo, application-scoped records and guarded J/K navigation. Typing in forms does not trigger shortcuts.

Index selected/pasted résumé text or import a JSON array of `{url, name, text}` records (up to 1,000 / 5 MB). Imports validate completely before any writes and cannot queue dispositions.

Local search adds explicit skill aliases, with source passages and query-term coverage. **It is not yet neural embedding search.** Repeating keywords cannot increase coverage.

Expand **Evidence, clean reading & bulk import**. Enter one criterion per line; `|` means alternatives. Analyze the indexed résumé to see exact quotations, mentions versus self-reported work claims, possible negations, and unknowns. Export reports with source SHA-256 and engine version.

Readability diagnostics flag duplicate/long bullet lines and text-encoding problems separately from capability. Clean reading normalizes presentation. No AI-authorship score or font-size inference is made from plain text.

Queue/audit export is local JSON, not execution. Data stays in extension-origin IndexedDB, with clear-all and seven-day expiry. No hosted model, runtime npm dependency, telemetry or network permission is required. Clear data or use a separate Chrome profile when switching organizations on the same Greenhouse origin.

## Still missing

Live Greenhouse write/authentication adapter, automatic résumé/PDF extraction, neural embeddings, automatic tenant isolation, permanent evidence-to-decision audit binding and validation against a real Greenhouse account. The tested bulk library is deliberately not wired to unverified live endpoints.

[Release details and limitations](docs/RELEASE-0.2.0.md) · [Verified prior art and licenses](docs/PRIOR-ART.md) · [Verification record](docs/BUILD-STATUS.md)

## Develop

```sh
npm ci --ignore-scripts
npm test
npm run package
uv run --with playwright==1.57.0 playwright install chromium
uv run --with playwright==1.57.0 python tests/browser_smoke.py
npm run audit:greenmaxing -- --download
```

Node 22+, TypeScript 5.8.3 and OS zip/unzip are required. Browser fixtures use synthetic loopback pages and a temporary test-only extension copy; production host guards remain unchanged.

CI fans out unit tests, browser tests, packaging and isolated third-party static inspection on each push. Publication uses the exact verified package, without rebuilding it. CI is **not** an autonomous coding agent; the separately configured ChatGPT task supplies recurring development work.

Do not commit real applicant documents, exports, credentials, signing keys or browser profiles to this public repository.
