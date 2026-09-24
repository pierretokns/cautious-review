# Privacy

## Default
Candidate content stays between Greenhouse and the browser.

Cautious Review has:
- no hosted LLM dependency
- no analytics or telemetry
- no external inference endpoint
- no API-key field
- no candidate-data backend

IndexedDB contains locally cached candidate text, URLs, review state, and later local embeddings. Clearing extension/site data removes the local cache.

Any future network permission beyond Greenhouse must be separately documented, justified, and opt-in.
