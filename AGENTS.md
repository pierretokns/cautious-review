# Agent instructions

Keep Cautious Review maximally simple.

- Chrome extension first; no server unless unavoidable.
- Candidate data is local by default.
- No cloud LLM dependency.
- Prefer tiny local WASM/WebGPU models and IndexedDB.
- Greenhouse remains the system of record.
- Machine output retrieves and explains evidence; humans make disposition decisions.
- Never turn embedding similarity into an automatic rejection.
- Preserve exact source passages for important inferences.
- Keep document-quality/readability signals separate from candidate capability.
- Check prior art before implementing substantial new functionality.
- Add tests for adapters and destructive workflows.
- No spreadsheets.
