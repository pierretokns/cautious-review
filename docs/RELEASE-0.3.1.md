# 0.3.1 — browser-session diagnostics preview

This preview advances the browser-session-first direction with passive schema diagnostics. It does not provide a completed direct Greenhouse session integration.

## Added

- An explicitly started, passive browser-session diagnostics recorder to help inspect request and response shapes while a reviewer browses Greenhouse normally.
- Sanitized schema observations limited to request method, redacted path template, allowlisted query-key names, allowlisted request/response schema key names and value types, and HTTP status code. Bounded JSON is examined in memory to derive shapes; candidate values, résumé contents, cookies, tokens, authorization values, and other header values are not retained or exported.
- A memory-only buffer with a limit of 100 observations or ten minutes. Stopping retains the buffer for optional manual export; clearing deletes it. Reloading or closing the page discards it. Export downloads `cautious-review-session-diagnostics.json` locally; the extension does not upload it.

## Scope and limits

Diagnostics are off until the reviewer starts them. They observe same-origin HTTPS JSON fetch/XHR traffic during ordinary browsing and pass the original calls and results through unchanged. They make no network requests and perform no candidate actions. The exported observations are untrusted schema hints, not verified or stable API contracts.

Direct browser-session-backed reads and actions are not implemented. Development is happening on the user's personal computer, without the signed-in work Greenhouse session needed to capture and validate actual request structures. Synthetic fixtures cannot establish real-account compatibility. Do not treat this preview as a no-admin direct integration.

The existing Harvest v3 integration remains an optional route and continues to require its endpoint permissions and a Site Admin authorizing user for list endpoints. The 0.3.0 behavior and limitations remain documented in [the 0.3.0 notes](RELEASE-0.3.0.md). See the [verification record](BUILD-STATUS.md) for the checks completed for this preview candidate; they do not establish real-account compatibility.
