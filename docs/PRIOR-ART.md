# Verified prior art and reuse

## open-greenhouse-mcp — MIT adaptations

Pinned source: [open-greenhouse-mcp](https://github.com/benmonopoli/open-greenhouse-mcp), commit `966fb2f36877dd62b14e924b9a7e1983ef88d11f`. `third_party/UPSTREAM.json` records that commit, the upstream MIT declaration, and the exact SHA-1 blob IDs for every adapted file.

The 0.2.0 sequential operation/result-accounting pattern from `src/greenhouse_mcp/harvest/batch.py` (blob `c0523a6881d82ccc739cd98b97fc69a47dea75d9`) is adapted in `src/batch.ts`. For 0.3.0, patterns from these additional upstream files are adapted in `src/harvest.ts` and `src/identity.ts`:

| Upstream source | Blob | Adapted behavior |
| --- | --- | --- |
| `src/greenhouse_mcp/client.py` | `d03a601cf12b11d9eb13737de64d9696b62e3a8c` | General request, error, pagination, and rate-limit handling patterns |
| `src/greenhouse_mcp/harvest/applications.py` | `339efe67cf5b202d4ca01c3cb85fa69689a61136` | Application lookup and disposition workflow concepts |
| `src/greenhouse_mcp/harvest/attachments.py` | `95aa3c24f34328c31704fc20cbc59fa1b5e28bb1` | Application/candidate résumé attachment discovery concepts |
| `src/greenhouse_mcp/harvest/job_stages.py` | `bc593856bc22faf1dc286513757cb2a19faf85c5` | Job-stage lookup |
| `src/greenhouse_mcp/harvest/rejection_reasons.py` | `27625d9847527a86b945b068f25dcefcf2fc08a8` | Rejection-reason lookup |

These are adapted patterns, not a wholesale port. The upstream v1/v2 Basic-auth transport and request bodies are not used. The live adapter is rebuilt for Harvest v3 Bearer tokens, OAuth `sub` attribution, v3 list filters, and v3 application action routes. It adds restricted origins, bounded responses, redirect rejection, pagination cycle and limit checks, explicit identity verification, refreshed preflight, immutable reviewed plans, durable pre-write intent and receipts, same-job move validation, and read-after-write reconciliation of v3's `204 No Content` responses. Unknown writes cannot be blindly retried. `src/identity.ts` fails closed on ambiguity; numbers on review routes are not guessed to be application IDs. The upstream `resume_parser.py` blob recorded as reviewed in `UPSTREAM.json` was not copied.

Only the needed Harvest request and application workflow patterns, attachment discovery, stage/reason lookup, and sequential action-accounting behavior were used. The upstream MCP server, MCP tool and prompt surfaces, and other unrelated server features were intentionally omitted because this product is a local Chrome extension. The complete required MIT notice and source references are in [`third_party/THIRD_PARTY_NOTICES.txt`](../third_party/THIRD_PARTY_NOTICES.txt) and are copied into the release package.

## Other bundled software and model

PDF.js 5.4.624 is bundled under Apache-2.0. Transformers.js 3.8.1, its bundled `@huggingface/jinja` 0.5.10 dependency, and ONNX Runtime Web are licensed under Apache-2.0, MIT, and MIT, respectively; the ONNX dependency notices are retained. The quantized `Xenova/all-MiniLM-L6-v2` model and tokenizer are pinned by revision and file hashes in `third_party/MODEL.json`, and use Apache-2.0 as declared in the pinned model metadata. The base model card snapshot is retained in `third_party/MiniLM-BASE-CARD.md`. Release packaging includes the applicable license and notice files; see the manifest and full text under `third_party/` and `vendor/` in the package.

## GreenMaxing — inspectable artifact, no source copied

Chrome Web Store ID: `npplpgbebfjnhmnaehlbhiohclhfgcml`. Public interaction concepts informed keyboard review and explicit bulk confirmation. No proprietary GreenMaxing code is copied or redistributed. `scripts/audit-greenmaxing.mjs --download` inspects the public signed CRX, verifies developer identity and signatures, inventories manifest permissions/files, and scans static network/dynamic-code indicators. It does not execute the extension, access Greenhouse, or use applicant data. A successful static scan is not a dynamic security audit or corporate approval; a failed download or verification is blocked, not a pass.

## Browser-session diagnostics — new, passive code

The 0.3.1 preview adds a locally implemented, opt-in observer for sanitized request-schema hints from normal Greenhouse browsing. It does not reuse or port a session API client, does not initiate requests, and does not perform candidate actions. The observer is not a verified API contract. Direct session-backed integration remains unimplemented: development is happening on the user's personal computer, without the signed-in work Greenhouse session needed to capture and validate real request structures.

## Not claimed as reused

The Searches implementation was not located. ApplyVerse, Autograph, Emplorio, and other previously discussed projects have not been incorporated. Local evidence rules are new code, not a port of an uninspected fit engine.

Before adopting further code, record its source revision, license, copied/adapted files, and behavior differences, then ship the required notices.
