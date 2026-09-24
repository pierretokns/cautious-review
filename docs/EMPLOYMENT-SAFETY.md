# Employment decision safeguards

Cautious Review assists a human reviewer; it does not autonomously make employment decisions.

- Retrieval similarity/coverage is not a qualification score.
- Job-fit findings must be traceable to résumé/application source evidence.
- Distinguish a term mention, self-reported work claim, possible conflict, and information that is simply not established.
- Absence from a résumé is not proof that a person lacks a skill.
- Document/readability diagnostics are kept separate from capability evidence and cannot automatically change disposition.
- Do not infer protected characteristics or citizenship/work-authorization status from names, geography, schools, employers, phone numbers or similar proxies.
- Preserve exact Greenhouse authorization/sponsorship question wording and applicant answers when those fields are later integrated.
- Reviewer decisions are queued explicitly. Future bulk execution requires a reviewed plan and matching count confirmation, validates every item before the first write, preflights current state, logs per-item receipts, and stops on ambiguous results rather than blindly retrying.
- Email sending is excluded from the reviewed batch core and requires a separate reviewed workflow.

The audit trail should make clear what evidence was shown, what the human selected, and what Greenhouse eventually accepted. Evidence engines/model versions must be recorded when their output is exported or attached to review records.
