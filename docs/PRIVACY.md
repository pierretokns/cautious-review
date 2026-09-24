# Privacy — preview limitations

No hosted LLM, analytics, telemetry, remote model assets, candidate-data server, or extension-origin fetch is implemented. Only the US/EU Greenhouse app hosts receive the content script. Extension CSP denies connect-src. This is not a claim that host permissions alone can prevent every possible data-exfiltration route.

Explicitly selected/pasted text, canonical record URLs, application IDs, timestamps and local decisions are stored in extension-origin IndexedDB. The webpage does not own this database. No automatic whole-page or hidden-field capture is performed. Candidate-provided text is displayed with textContent, not HTML execution.

Local entries expire after seven days when the extension is used; clear-all deletes the local cache and queue immediately. This TTL is for a working cache, not a recommendation to destroy required employment records. Greenhouse records are unaffected.

The preview does not implement reliable tenant/account identity detection or access revocation. Use a dedicated Chrome profile and clear Cautious Review data before switching accounts. IndexedDB is not application-level encrypted. Managed endpoint protection and organizational approval remain necessary. Clearing normal browsing history is not a reliable way to clear extension storage; use the overlay's Clear local data button.

If the initial 0.1.0 skeleton was installed, its database named `cautious-review` may remain under the Greenhouse page origin. This release does not silently manipulate unrelated page storage. Remove that specific legacy database through browser developer storage tools; do not clear other Greenhouse databases indiscriminately.

No real applicant data or browser profiles belong in this public repository or test artifacts. Tests use synthetic records only.
