# 0.3.3 — compatibility-boundary preview

This preview updates the browser compatibility boundary while preserving the local, read-only page-linked résumé reader and optional Harvest integration.

## Compatibility and install

- The extension declares Chrome 128 as its minimum version. This is a compatibility floor, not a claim that every Chrome 128 environment has been tested.
- Page scripts and current-tab URL confirmation run only on the finite set `app.greenhouse.io`, `app2.greenhouse.io` through `app15.greenhouse.io`, and `app.eu.greenhouse.io`. The extension does not request a global tabs permission, wildcard Greenhouse access, or customer-specific domains.
- The reader handoff verifies the browser's current tab URL in addition to the URL reported by the page, so stale content-script URLs after single-page navigation fail closed. Signed document URLs share one 16 KB size limit and the common approved-storage-host validator.
- Greenhouse's public setup guidance describes numbered `app[#].greenhouse.io` accounts, and its integration guidance gives `app15.greenhouse.io` as an example ([extension setup](https://support.greenhouse.io/hc/en-us/articles/8302339682843-Install-the-Greenhouse-Recruiting-Chrome-extension), [TextUs integration](https://support.greenhouse.io/hc/en-us/articles/360017515752-TextUs-integration)). The extension uses a finite explicit host list; it does not infer that all possible shards or accounts are supported.
- Install the extracted ZIP through `chrome://extensions` with Developer mode and **Load unpacked**. The optional CRX remains self-signed with an ephemeral identity and is not a Web Store installation. Use the `BUILD.json` and `SHA256SUMS` shipped with the exact release artifact.

## Scope and limits

The page-linked reader still requires a clearly identified candidate/application page and exactly one visible résumé attachment control. It retrieves the preview through the browser session, then requires a separate trusted click before downloading the approved document URL and extracting it locally. It is not a general browser-session API adapter and does not perform candidate writes. The optional Harvest v3 path remains separate and is used for reviewed Greenhouse actions.

Public Greenhouse documentation supports the numbered-host naming pattern and the `app15` example. It does not establish that the private résumé-preview route is a supported public API. The page-linked route and account permissions have not been validated against a real Greenhouse account; automated fixtures use synthetic pages, records, and documents. Compatibility on each listed account host and behavior in a user's hiring workflow remain unverified.

Greenhouse remains the system of record. Local analysis retrieves and explains evidence; the reviewer makes every employment decision.
