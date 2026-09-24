# Privacy

Cautious Review is local-first.

- Candidate text, criteria, evidence reports and queued decisions stay in the extension/browser unless the reviewer explicitly exports a file.
- No telemetry, analytics, hosted inference service, external AI key, developer backend, or runtime candidate-data endpoint exists in 0.2.0.
- Production CSP uses `connect-src 'none'`, and release packaging statically rejects common runtime network primitives in shipped JavaScript.
- IndexedDB is owned by the extension service worker rather than the Greenhouse page origin.
- Cached documents, queued decisions and audit records expire after seven days; the reviewer can clear all local state at any time.
- Bulk import validates all records before storage, is scoped to the current Greenhouse origin, strips unrelated URL query values, and refuses imported decisions/actions.
- JSON exports are explicit user downloads and may contain confidential recruiting information; they are never uploaded automatically.

A future Greenhouse write adapter will necessarily communicate with the reviewer's Greenhouse instance. That capability must be separately permissioned, documented, tested and auditable before release.
