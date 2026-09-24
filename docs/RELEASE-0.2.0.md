# 0.2.0 — local evidence review preview

## Implemented

- Criterion-by-criterion source passages, UTF-16 character offsets, source SHA-256 and engine version.
- Labels: mention, self-reported work claim, possible negation/conflict, not established.
- Inspectable skill aliases with provenance. This is **not neural embedding search**.
- Repeated keywords cannot improve query-term coverage. Retrieval coverage is not a hiring score.
- Plain-text diagnostics: duplicate lines, long/many bullets, invisible Unicode, extraction corruption. No AI-authorship claim, font inference, or capability penalty.
- Clean-text reading view; original files remain unchanged.
- Atomic JSON résumé imports: up to 1,000 records / 5 MB per file, current Greenhouse origin only. Invalid batches do not partially save; imports cannot contain decisions.
- Queue/audit JSON export and separate evidence-report export. No automatic uploads.
- Sequential bulk library adapted from MIT-licensed open-greenhouse-mcp, with preflight, count, reason/stage, cancellation, durable receipts and ambiguous-write safeguards. **No live adapter is connected.**
- Genuine CRX3 packaging, signature/payload checks and parallel gated CI.

## Install

Download the ZIP from a successful GitHub preview release, extract it, open `chrome://extensions`, enable Developer mode, and Load unpacked from the folder containing manifest.json. Reload Greenhouse after installing/updating. Keep the same unpacked folder path for later previews where possible. Local data is a cache, not a permanent HR record.

The CRX is self-signed, not Web Store signed. Default packaging uses a fresh ephemeral key, never writes the private key to disk, and reports the extension ID in BUILD.json. CRX IDs change per build and do not support a stable update channel. Chrome installation restrictions still apply. A privately supplied RSA PEM via CRX_SIGNING_KEY can provide persistent identity in a controlled build; never commit the key. ZIP/unpacked is recommended for ordinary Mac/Windows Chrome.

## Explicit limitations

No live rejection, advancement, messaging, Harvest authentication, automatic résumé download, PDF text extraction, font-size analysis, LLM, or neural embeddings yet. Rules are simple retrieval heuristics; work claims are not verified and matching is not a validated predictor of success. Analysis displays a bounded set of excerpts, not exhaustive findings. Criteria are explicitly entered for the current analysis, not inferred or saved across jobs.

Source offsets are JavaScript UTF-16 character offsets; reports include the text snapshot's SHA-256. Queue audit does not yet bind each decision to an evidence-report snapshot. Exports are separate. The local audit is mutable, not tamper-proof or a substitute for required HR records.

Storage is extension-origin IndexedDB without application-layer encryption. Browser-profile/disk security matters. Cache, queue and audit expire after seven days when a request next triggers cleanup. Ordinary browsing-data clearing does not necessarily clear extension storage: use Clear local data. Organizations sharing one Greenhouse origin are not automatically isolated: clear before switching accounts or use separate Chrome profiles.

All fixtures are synthetic. Never commit candidate documents, exports, API keys or browser profiles to this public repository.
