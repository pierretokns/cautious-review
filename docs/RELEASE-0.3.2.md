# 0.3.2 — page-linked résumé reading preview

This preview adds a narrow, read-only browser-session path for retrieving one résumé linked from the current Greenhouse candidate application page. It does not require a Harvest API key for this résumé read. Harvest v3 remains optional for loading application lists and is still required for reviewed Greenhouse actions.

## Read one page-linked résumé

On a supported Greenhouse application page, click **Read this résumé locally · no admin key**. The extension requires an unambiguous candidate/application identity and exactly one visible résumé or CV attachment link/control. It requests that attachment's preview from the current Greenhouse host using the reviewer's existing browser session. It rejects redirects and unexpected response formats, unwraps the preview's document URL only when it targets an approved Greenhouse storage host, then rechecks that the page, application, and attachment have not changed.

The local reader opens with a one-use handoff. The signed document URL is held in the extension service worker's memory, not placed in the reader's address bar or extension storage. The handoff expires after 90 seconds and is consumed once. In the reader, click **Load page-linked résumé locally** to fetch the document from the approved Greenhouse storage host and extract its text on-device. PDF parsing, evidence display, and local search use bundled code and model assets; there is no cloud inference fallback. Extracted text is saved in local extension storage with the existing seven-day cleanup behavior. Use **Clear all local data** to remove saved text.

The reader labels the candidate/application IDs as coming from the page; it does not independently verify them with Harvest. Greenhouse may link a résumé to a candidate profile rather than one application, so the attachment link alone does not verify which application it belongs to. Confirm that the displayed résumé is the version relevant to the application before using its evidence.

The path only reads the one résumé attachment linked by the current page. It does not list or search candidates, discover all documents, call a parsed-resume endpoint, or perform disposition, stage, or other candidate writes. The user's Greenhouse account must already be able to view the candidate and attachment. If there is no unique visible attachment link/control or the private preview interface differs, the read fails closed; import a résumé file or use the optional Harvest flow instead.

## Validation and limits

The private preview route was identified through public-source research and implemented independently. It has not been validated against the user's authenticated Greenhouse account. Automated tests use synthetic pages and records; they do not establish real-account compatibility or production hiring behavior. See the [browser-session research record](BROWSER-SESSION-RESEARCH.md) and [build verification record](BUILD-STATUS.md) for the inspected sources and verification scope.

The optional Harvest v3 integration remains a distinct path. It requires its configured endpoint permissions and a Site Admin authorizing user for list endpoints. Reviewed Harvest actions continue to use explicit plans, preflight checks, durable receipts, and read-after-write reconciliation. This release does not add session-based candidate actions.

The extension is limited to the supported Greenhouse account hosts listed in the [README](../README.md). Custom SSO subdomains are not included. The preview CRX is self-signed; use the ZIP with Chrome's **Load unpacked** flow for the ordinary preview installation. See [privacy notes](PRIVACY.md), [architecture](ARCHITECTURE.md), and [employment safeguards](EMPLOYMENT-SAFETY.md) for data handling and decision boundaries.
