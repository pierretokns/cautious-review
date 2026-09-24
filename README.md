# Cautious Review

Local-first, keyboard-first review for Greenhouse.

## Principles
- Human decision, machine assistance.
- Candidate data stays local by default; no hosted LLM required.
- Evidence over opaque scores.
- Fast keyboard review and auditable queued actions.
- Search/ranking retrieves evidence; it does not autonomously reject.

## MVP
- J/K: next/previous
- A: queue advance
- M: queue maybe
- R: queue reject
- 1-9: rejection reasons
- U: undo
- /: local search
- IndexedDB candidate/review storage
- zero telemetry / external AI

Build with `npm install && npm run build`, then load `dist/` unpacked in Chrome.
