# Architecture — 0.1.1 preview

Greenhouse remains the system of record. A classic content script displays a shadow-DOM toolbar. Explicit actions are sent through validated extension runtime messages to an ES-module service worker. The worker owns IndexedDB, search, local decisions and transactional undo history.

Unlike the initial skeleton, the content script never opens IndexedDB, indexes the entire page, uses an arbitrary pathname as a candidate ID, or indexes on every DOM mutation. Candidate-only pages cannot queue application dispositions. Unknown and conflicting URL identifiers fail closed.

The build uses TypeScript directly: classic content.js plus ES-module background/core/storage. The old Vite configuration, substring search and page-origin storage are removed. This is source/build simplification, not a change to the local-first design.

## Shipping loop

A push starts tests immediately. A successful main-branch run publishes a commit-specific preview ZIP and checksum. Publication requires the independent browser fixture job to pass; no release is claimed merely because a workflow file exists. CI creates no coding-agent loop and needs no inference-provider credentials.

## Next increments

Real Greenhouse DOM/application identification fixtures; account-scoped storage; approved Harvest/session action adapter with preview, permissions and retry safety; PDF.js local parsing; tiny local embeddings behind a narrow interface; evidence-backed job criteria; readability diagnostics separate from capability; full audit export. No autonomous employment disposition.
