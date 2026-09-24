# Employment decision safeguards

Cautious Review is designed to assist a human reviewer, not make autonomous employment decisions.

## Rules
- Retrieval similarity is not a qualification score.
- Every inferred job-fit signal should be traceable to source evidence.
- Distinguish **found**, **not found**, **contradicted**, and **unknown**.
- Absence from a resume is not automatically evidence that a person lacks a skill.
- Do not infer protected characteristics.
- Work-authorization handling should preserve the exact Greenhouse question and answer. Do not silently convert geography, names, schools, or employers into citizenship/visa status.
- Reviewer decisions are queued locally before any bulk write.
- Keep an audit trail of evidence shown, reviewer action, reason, model/version metadata, and resulting Greenhouse action.

Document/readability diagnostics (font size, density, excessive formatting, repeated keyword stuffing) should be shown separately from evidence of job capability.
