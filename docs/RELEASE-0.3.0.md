# 0.3.0 — live-testing preview

## Added

- Live Review uses Harvest v3 Bearer access tokens. A separate local Node helper uses a Harvest V3 OAuth client ID and secret to mint a short-lived token with the selected numeric Greenhouse user ID as `sub`. The client secret stays in the helper; the token stays in extension-page memory until disconnect or page close.
- Read users, jobs, applications, candidates, current application stages, job interview stages, résumé attachments, and rejection reasons. Application identity is verified against Harvest before review or action preparation.
- Discover résumé attachments on the application or candidate, retrieve from approved Greenhouse storage hosts, and extract PDF or UTF-8 text locally. Scanned PDF OCR is not included.
- Bundle PDF.js and a revision-pinned, quantized MiniLM model for local browser WASM inference. Lexical and alias search remains available without the model; there is no cloud or Chrome built-in model fallback.
- Queue individually reviewed reject, advance, same-job move, and unreject actions. Advance uses the v3 move endpoint with the current stage; a selected move supplies both source and destination. Execution refreshes each item, displays a short-lived immutable preview, and requires explicit review plus exact-count confirmation.
- Write sequentially with a durable `started` receipt before each request. V3 writes return `204 No Content`; the extension rereads application, stage, and rejection details to verify outcomes. A changed preflight skips and stops the plan; uncertain or mismatched outcomes are marked unknown, stop later execution, and cannot be automatically replayed. Receipts persist locally until cleared.

## Safety and limits

Create a Harvest V3 OAuth credential and choose the least-privilege endpoint permissions for users list, jobs list, applications list, candidates list, application stages list, job interview stages list, attachments list, rejection reasons list, rejection details list, and the application reject/move/unreject operations being used. Greenhouse's public docs describe permissions by endpoint and the credential UI exposes its selectable scopes; Cautious Review does not invent scope identifiers. All list endpoints require authorization by a Site Admin user, supplied as the token's `sub`. Greenhouse's guidance recommends server-side secret/token storage. This local helper keeps the client secret out of the extension and command line and stores no credentials, but the secret still exists briefly in local helper memory; the short-lived access token is printed only after confirmation and then pasted into the extension.

No rejection email is requested. Greenhouse may run organization-configured automations. Cancellation stops later requests but cannot reverse one already sent. Unreject is a separate action, not rollback of other side effects. V1/v2 Harvest endpoints ended August 31, 2026; read Greenhouse's [authentication guide](https://harvestdocs.greenhouse.io/docs/authentication) and [migration guide](https://harvestdocs.greenhouse.io/docs/step-by-step-migration-instructions) before configuring an integration.

Candidate text, decisions, and their local audit entries remain in extension storage and expire after seven days when cleanup runs. Live receipts persist until cleared. Storage is not application-encrypted. Use separate Chrome profiles or clear local data when switching accounts on a shared Greenhouse origin.

All browser fixtures use synthetic data and local pages. There is no real Greenhouse account end-to-end validation or production hiring validation. See [verification record](BUILD-STATUS.md); consult the exact release build for its own check results and artifact hashes.

## Historical notes

The 0.2.0 release notes document the evidence engine before Live Review. Their statement that a live adapter, résumé download/PDF extraction, and neural embeddings were unfinished is historical and superseded by this release's implemented preview behavior.
