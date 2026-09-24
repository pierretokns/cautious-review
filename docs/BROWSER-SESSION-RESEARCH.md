# Greenhouse browser-session research

Research snapshot: 2026-09-24. This note records public-source evidence relevant to a possible browser-session read path. It distinguishes documented Greenhouse APIs from routes visible in public application code. Findings are for investigation only: no code from the projects below is copied into Cautious Review, and source-visible routes are not treated as supported API contracts.

## What public sources establish

Public sources are sufficient to identify candidate read routes and request patterns. They do not establish that a route works for a particular Greenhouse tenant, user, role, or current UI version. No authenticated request against the user's work account has been made, so account-specific access, response shape, CSRF behavior, and current endpoint behavior remain unvalidated.

Greenhouse documents multiple separate API surfaces. Harvest is its recruiting-data integration API; the Job Board API is for publishing public job data and accepting applications; Candidate Ingestion is a partner API for sourcing integrations. The official overview and developer-resource directory describe these as distinct surfaces ([API overview](https://support.greenhouse.io/hc/en-us/articles/10568627186203-Greenhouse-API-overview), [developer resources](https://developers.greenhouse.io/)). Harvest v3 has public route documentation for listing applications, application stages, jobs, attachments, users, and other resources. For example, its documented `GET /v3/applications` accepts application/job filters, `GET /v3/application_stages` exposes stage history, and `GET /v3/attachments` returns time-limited document URLs ([applications](https://harvestdocs.greenhouse.io/reference/get_v3-applications), [application stages](https://harvestdocs.greenhouse.io/reference/get_v3-application-stages), [attachments](https://harvestdocs.greenhouse.io/reference/get_v3-attachments)). These are the documented Harvest API, not evidence of undocumented `app.greenhouse.io` routes.

The official Candidate Ingestion API documentation says its partner API can retrieve candidate data, including application status and current stage, and that the profile link requires the user to be signed in. The request is made to `api.greenhouse.io/v1/partner/candidates`, with candidate IDs and authorization; results are limited to candidates the current user/API identity may view ([official endpoint documentation](https://github.com/grnhse/greenhouse-api-docs/blob/master/source/includes/candidate-ingestion/_candidates.md), [official introduction](https://github.com/grnhse/greenhouse-api-docs/blob/master/source/includes/candidate-ingestion/_introduction.md)). This is a documented, permission-scoped partner API, not an anonymous public candidate-data endpoint and not the recruiter's browser-session app API.

The Job Board API is similarly distinct: its public job-board routes expose job-post data, while submitting an application is a separate candidate-facing operation ([official API directory](https://developers.greenhouse.io/), [official application submission docs](https://github.com/grnhse/greenhouse-api-docs/blob/master/source/includes/job-board/_applications.md)). Public job-board clients and applicant-side autofill tools therefore do not demonstrate access to a recruiter’s candidate-review data.

## Public recruiter-side extension examples

### `fieldbook/blindaudition`

- Repository and pinned tree: [`fieldbook/blindaudition` at `9b612367028c6aa62dbffac742633fb704b7175d`](https://github.com/fieldbook/blindaudition/tree/9b612367028c6aa62dbffac742633fb704b7175d) (2018-12-20).
- License: MIT, copyright Fieldbook, Inc. 2016 ([license at the pinned commit](https://github.com/fieldbook/blindaudition/blob/9b612367028c6aa62dbffac742633fb704b7175d/LICENSE.txt)).
- Relevant files: [manifest](https://github.com/fieldbook/blindaudition/blob/9b612367028c6aa62dbffac742633fb704b7175d/manifest.json), [Greenhouse adapter](https://github.com/fieldbook/blindaudition/blob/9b612367028c6aa62dbffac742633fb704b7175d/sites/greenhouse.js), [content script](https://github.com/fieldbook/blindaudition/blob/9b612367028c6aa62dbffac742633fb704b7175d/blinder.js).
- Evidence: a Manifest V2 content script matches recruiter profile pages under `app.greenhouse.io/people/*`; its Greenhouse-specific adapter uses DOM selectors to mask visible profile, contact, scorecard, and notes content. It does not document or implement a recruiter API client.
- Limits: old selectors and Manifest V2 make this stale precedent. The shared content script also includes behavior beyond the Greenhouse adapter, including a remote text-neutralization request. No source was copied or adapted.

### `paritoshshah/link.gh`

- Repository pinned to commit [`d2701544c9f18326dadfb1c0ec17568b3d57bf02`](https://github.com/paritoshshah/link.gh/tree/d2701544c9f18326dadfb1c0ec17568b3d57bf02) (2016-07-20).
- License: no `LICENSE` file and no license declaration was found in the repository metadata. Treat as unlicensed; no source was copied or adapted.
- Relevant files: [manifest](https://github.com/paritoshshah/link.gh/blob/d2701544c9f18326dadfb1c0ec17568b3d57bf02/manifest.json), [Greenhouse content script](https://github.com/paritoshshah/link.gh/blob/d2701544c9f18326dadfb1c0ec17568b3d57bf02/gh.js).
- Evidence: an extension content script fills recruiter prospect-form fields such as first/last name, title, company, and social media from a LinkedIn profile. This is DOM form assistance, not a candidate-review API client.

## Public source showing recruiter-app read routes

### `ravsssh/greenhouse-cv-crawl`

- Repository pinned to merge commit [`ee328d1234a428a7ecb1be837146d20d32933303`](https://github.com/ravsssh/greenhouse-cv-crawl/tree/ee328d1234a428a7ecb1be837146d20d32933303) (2026-09-17).
- License: no `LICENSE` file and no license declaration was found in the repository metadata. Do not copy, adapt, or redistribute its source.
- Relevant source evidence: [page operations](https://github.com/ravsssh/greenhouse-cv-crawl/blob/ee328d1234a428a7ecb1be837146d20d32933303/chrome-extension/page-operations.js), [API crawler](https://github.com/ravsssh/greenhouse-cv-crawl/blob/ee328d1234a428a7ecb1be837146d20d32933303/scripts/greenhouse_api.py), [attachment handling](https://github.com/ravsssh/greenhouse-cv-crawl/blob/ee328d1234a428a7ecb1be837146d20d32933303/scripts/attachment.py).
- Read paths visible in that source include `GET /alljobs`; `GET /plans/{jobId}/candidates?hiring_plan_id={jobId}&job_status=open&sort=last_activity+desc&stage_status_id=2&type=all&page=N`; candidate/application links shaped like `/people/{personId}/applications/{applicationId}` (including a `/redesign` variant); and `GET /attachment_previews/{attachmentId}?width=800`, whose response is used to find a signed PDF URL.
- The crawler also submits `POST /people/bulk/print_resumes` with application IDs and a CSRF token. Its UI indicates Greenhouse emails batches of PDFs; this is not a direct resume-text endpoint and is not included as a suggested integration route.
- The crawler's own map deduplicates by person ID, which can collapse distinct applications for one person. Its public source does not establish a parsed-resume-text endpoint, disposition/move route, or a supported contract. These are route observations from an unlicensed, third-party project, not verified Greenhouse documentation or validation against the user's account.

## Public CDN source evidence

An independent bounded inspection followed the runtime chunk mapping from a publicly served Greenhouse login page and fetched 11 runtime-referenced chunks. The login page also referenced the runtime resolver itself. These CDN assets are evidence about bytes served to that unauthenticated page at inspection time; this note does not infer a source license or endorse reuse. SHA-256 values below identify the exact fetched bytes; they do not establish authorship, endpoint support, or tenant compatibility.

| Public CDN asset | SHA-256 |
| --- | --- |
| [`runtime-95c83d6aea509cb9.js`](https://recruiting.cdn.greenhouse.io/assets/webpack/runtime-95c83d6aea509cb9.js) | `94d0706f8eebb6d5e2f37e3fe0303a5faa42353afcc24ea862ded5392fb4b795` |
| [`js-legacy-355e89f779909991.js`](https://recruiting.cdn.greenhouse.io/assets/webpack/js-legacy-355e89f779909991.js) | `fe542ca3ed66edd1d9c8c961a93caad0e672498f997e8bac6da5cedcaf247bc3` |
| [`mounter_global_agent-3855c6d66a2d3248.js`](https://recruiting.cdn.greenhouse.io/assets/webpack/mounter_global_agent-3855c6d66a2d3248.js) | `e9575dd8678d3a3ad3953e5c9d42d83d636e9962d58907e004125a03b258e60a` |
| [`3353-9e39f0ed2b5089d0.js`](https://recruiting.cdn.greenhouse.io/assets/webpack/3353-9e39f0ed2b5089d0.js) | `bb5a87b0749fbb2d447a64660250251e4ac07aa4cb21378c7f788477df61be92` |
| [`4276-029283a156be33d7.js`](https://recruiting.cdn.greenhouse.io/assets/webpack/4276-029283a156be33d7.js) | `c2e33e433c1c8850e9f2ed31e94b3d39b18413d712e0463c9463c21781c39851` |
| [`8476-592ef49c646f118e.js`](https://recruiting.cdn.greenhouse.io/assets/webpack/8476-592ef49c646f118e.js) | `7408d801a5d893bf9fafba9d3eb138c8c3403df897a44c24058b2acb419bdc07` |
| [`head-common-59d97d9c193ed519.js`](https://recruiting.cdn.greenhouse.io/assets/webpack/head-common-59d97d9c193ed519.js) | `0c6caf0bd97a4b9d588ae39a2d7316093d17c4aef4d29ac437c467b8f5dacb9c` |
| [`stage_automation_icon-15c4a8bcf28e1bb9.js`](https://recruiting.cdn.greenhouse.io/assets/webpack/stage_automation_icon-15c4a8bcf28e1bb9.js) | `4c6372bd5924c9cd4e5f5c88f14eefe35c1ea4e8164e9252c9927ad6024497d7` |
| [`8944-50a9137c471f343b.js`](https://recruiting.cdn.greenhouse.io/assets/webpack/8944-50a9137c471f343b.js) | `b243f8d8185daba625528f68d3dd58e9b2286fdea93ce23273ba3ad53532de78` |
| [`9384-02c0d8b39d96009e.js`](https://recruiting.cdn.greenhouse.io/assets/webpack/9384-02c0d8b39d96009e.js) | `700fc7a6d5e5107eef2ccba9867f22d3f4338bd7075b07d801c59874bc2ba28b` |
| [`vendor-52b558ec0ff42f3c.js`](https://recruiting.cdn.greenhouse.io/assets/webpack/vendor-52b558ec0ff42f3c.js) | `686567559a0c2bc9797093d48110893bf803a61bfe91807a0d3b23da562db7e6` |
| [`global_agent_component-ef6fe89701c48e72.js`](https://recruiting.cdn.greenhouse.io/assets/webpack/global_agent_component-ef6fe89701c48e72.js) | `daf2043141d7a075428a0720d5b1da73238162209ca2c061e2aa9f874c1271cd` |

Across the 11 fetched chunks, the only `resume_text` match is in `js-legacy` and is the `#resume_text` selector hidden during resume upload, not a parsed-resume API path. That bundle registers route-helper symbols `Person.attachment_preview_path_template`, `Person.person_attachment_path_template`, `change_application_state_path_template`, and `application_stage_tasks_path_template`; the template definitions/call sites and literal target paths are absent from these chunks. Non-legacy `attachmentPreview` matches are generic editor-component methods. This bounded search found no parsed-resume endpoint or application-review route path in the inspected chunks; it does not establish whether separately loaded or authenticated application assets contain them.

The legacy bundle's referenced public source map, [`js-legacy-355e89f779909991.js.map`](https://recruiting.cdn.greenhouse.io/assets/webpack/js-legacy-355e89f779909991.js.map), is 1,544,140 bytes with SHA-256 `d23bb5bf649cfe15f7462e080635412d7d582ae2f33475171e4f2e681951a5db`. Its included `legacy/routes.js` source compiles `Routes.Person.attachment_preview_path_template`, `Routes.Person.person_attachment_path_template`, `Routes.change_application_state_path_template`, and `Routes.application_stage_tasks_path_template` from the `window.Routes` object. This confirms those template values are supplied outside this static source file; the map does not include their values, HTTP methods, request payloads, permission conditions, or response schemas. It is evidence that the authenticated page supplies route metadata, not a route specification or an account-tested contract.

## Validation boundary

The source findings establish that public material can reveal plausible read routes without first having a signed-in work session. A real Greenhouse session is still required to validate which observed routes are active for this tenant, what the signed-in user's role can access, what request headers or CSRF state are required, and what the live response schema contains. Until that validation exists, route observations remain research leads; no session-backed read or action behavior is claimed complete here.

The documented Harvest API remains the distinct, supported integration route. The browser-session direction is being explored as an optional read path using independent implementation; the sources above are not implementation material.
