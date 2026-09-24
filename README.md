# Cautious Review

**0.3.1 preview** for local résumé evidence review. The next integration direction is browser-session-first, so a reviewer can use their existing Greenhouse session without requiring Harvest Site Admin access. That direct session integration is not implemented yet. The existing Harvest integration remains an optional admin-based route. Greenhouse remains the system of record, and a reviewer chooses each decision and confirms the complete plan before any write is sent.

## Install

Use desktop Chrome 120 or later. Extract the preview ZIP, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select the extracted folder containing `manifest.json`. Reload Greenhouse after installing or updating. Corporate browser policy may restrict unpacked installations.

The optional CRX is self-signed, not Web Store signed. Its signing identity is ephemeral and changes between builds, so it has no stable update channel. The ZIP/unpacked path is the ordinary preview install. Release artifacts should include `BUILD.json` and `SHA256SUMS`; use the values attached to the exact artifact being installed.

## Local review

The extension overlay can queue local advance, maybe, and reject decisions while reviewing a Greenhouse page. It does not write to Greenhouse. The Live Review page is opened from the extension toolbar or overlay and can load applications from Harvest, discover résumé attachments, and retrieve a selected résumé. PDF and UTF-8 text extraction happen in the extension page locally. Scanned PDFs need OCR outside this preview or pasted text.

Résumé text, local decisions, and their local audit entries are stored in extension-origin IndexedDB. They expire after seven days when cleanup next runs. Live action receipts use a separate local store and persist until cleared. Use **Clear all local data** or a separate Chrome profile when switching Greenhouse accounts on the same origin. Browser history clearing does not reliably clear extension storage. IndexedDB is not application-encrypted.

Local analysis shows source passages, mentions versus self-reported work claims, possible negations, and unknowns. Alias and lexical matching is available without a model. Hybrid retrieval can also use the bundled, quantized MiniLM model through local WASM in the browser. It does not use Chrome's built-in AI or a cloud fallback. Retrieval similarity is not a qualification score or a disposition recommendation. Document readability diagnostics remain separate from capability evidence.

## Browser-session diagnostics

The 0.3.1 preview adds an opt-in, passive diagnostic recorder to help map the request and response shapes used by a real Greenhouse browser session. Start it explicitly, browse Greenhouse normally, then stop and export the local JSON file for manual review. It observes same-origin HTTPS JSON fetch/XHR traffic, forwards the original requests and responses unchanged, initiates no requests, and performs no candidate actions. It records only request methods, redacted path templates, allowlisted query-key names, allowlisted request/response schema key names and value types, and HTTP status codes. Candidate values, document contents, cookies, tokens, and authorization values are not retained or exported. The in-memory buffer is limited to 100 observations or ten minutes; it is discarded when the page closes or reloads, and can be cleared before export.

This diagnostic export is untrusted schema evidence, not a verified API contract. Development is happening on the user's personal computer, where the signed-in work Greenhouse session is not available to capture and validate actual request structures. Cautious Review therefore does not yet make direct session-backed reads or actions. No claim of no-admin direct integration or real-account validation is made for this preview.

## Optional Live Harvest integration

The existing optional integration uses Harvest v3. It requires a **Harvest V3 (OAuth)** credential, the required endpoint permissions, and a Site Admin authorizing user for list endpoints. It is not the browser-session path and does not remove that admin requirement.

Greenhouse's guidance says to store client secrets server-side. This preview's standalone local helper keeps the secret out of the extension and terminal command line, but uses it on your computer to request a token; it is a local operator convenience, not a hosted credential broker. Download `cautious-review-token.mjs` with the preview release and run it with Node 22 or newer in an interactive terminal. It asks for the OAuth client ID, your numeric Greenhouse user ID, and the client secret (hidden while typing), then requests a short-lived bearer token from `auth.greenhouse.io`. It sends no candidate data and stores no credential or token. The helper asks before printing the token once so you can copy it.

Paste that token and the same user ID into Live Review. The token stays in the page's memory and is cleared from its input after connection; disconnect or close the page to discard it. It is not saved to extension storage or exposed to Greenhouse page scripts. When it expires, run the helper again and reconnect. The helper contacts the OAuth host; the extension itself uses only Harvest and approved Greenhouse résumé-storage hosts.

Select read permissions for users, jobs, applications, candidates, application stages, job interview stages, attachments, rejection reasons, and rejection details. Enable application reject, move, and unreject write permissions only if you intend to use those actions. In v3 the advance action is a reviewed move to the next ordered stage.

Actions are reject, advance one ordered stage, move to a selected stage within the same job, and unreject. The interface prepares a refreshed preview with application identity, current state, target or reason, and the acting user. The reviewer must affirm the plan and type its application count. Before each write, the extension checks that application state and plan details still match. Requests run sequentially. Harvest v3 writes return no response body, so Cautious Review rereads the application and related stage or rejection details to confirm the result. No rejection email is requested, though Greenhouse may run organization-configured automations.

The extension saves a durable `started` receipt before sending each write. It never blindly retries an uncertain write. Unknown outcomes stop the plan and require reconciliation in Greenhouse; they must not be replayed automatically. Cancellation stops between requests and cannot undo one already sent. Unreject is a separate action and does not reverse emails, interviews, or other side effects. Receipts remain local until cleared and can be exported. See Greenhouse's [authentication guide](https://harvestdocs.greenhouse.io/docs/authentication) and [v1/v2-to-v3 migration guide](https://harvestdocs.greenhouse.io/docs/step-by-step-migration-instructions).

## Limits and validation

Greenhouse identity and action behavior have not been validated end-to-end against a real Greenhouse account. Automated browser fixtures use synthetic applications and documents; they are not real-account or production hiring validation. See the [0.3.1 preview notes](docs/RELEASE-0.3.1.md), [0.3.0 release notes](docs/RELEASE-0.3.0.md), and [verification record](docs/BUILD-STATUS.md) for scope and limits.

Only the listed Greenhouse application hosts are supported: `app.greenhouse.io`, `app2.greenhouse.io`, `app3.greenhouse.io`, `app4.greenhouse.io`, `app5.greenhouse.io`, and `app.eu.greenhouse.io`. Custom SSO subdomains are not included. Candidate data stays local by default, but the Live Review page intentionally sends authorized Harvest requests and résumé downloads to Greenhouse's approved storage hosts.

The upstream MCP server's server, prompt, and unrelated MCP tool features are outside this extension's scope. No proprietary GreenMaxing code is copied. Third-party source and model records are in [`third_party/`](third_party/THIRD_PARTY_NOTICES.txt), [`docs/PRIOR-ART.md`](docs/PRIOR-ART.md), and the pinned metadata files.

## Develop

```sh
npm ci --ignore-scripts
npm run models
npm test
npm run package
uv run --with playwright==1.57.0 playwright install chromium
uv run --with playwright==1.57.0 python tests/browser_smoke.py
uv run --with playwright==1.57.0 python tests/browser_live.py
npm run audit:greenmaxing -- --download
```

Node 22+, TypeScript 5.8.3, and OS zip/unzip are required. The browser fixtures use synthetic records and local pages. Their success does not establish real Greenhouse integration or production hiring behavior. Do not commit real applicant documents, exports, credentials, signing keys, or browser profiles to this public repository.

Earlier preview history and evidence-engine behavior are recorded in [0.2.0 release notes](docs/RELEASE-0.2.0.md). See [employment safeguards](docs/EMPLOYMENT-SAFETY.md), [privacy notes](docs/PRIVACY.md), [architecture](docs/ARCHITECTURE.md), and [verified prior art](docs/PRIOR-ART.md).
