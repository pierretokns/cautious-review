# Architecture

Greenhouse is the system of record. Cautious Review is a local browser layer.

## Flow
1. Extract candidate/application content visible to the authenticated reviewer.
2. Store candidate documents and queued reviewer decisions in IndexedDB.
3. Search locally. MVP uses lexical retrieval; next step adds a tiny WASM/WebGPU embedder.
4. Return source passages as evidence.
5. Reviewer explicitly chooses advance/maybe/reject.
6. A future Greenhouse action adapter executes those human decisions in bulk.

## Non-goals
- No server for v1.
- No cloud inference or telemetry.
- No autonomous rejection.
- No opaque candidate score as a hiring decision.

## Local ML interface

```ts
interface Embedder {
  embed(texts: string[]): Promise<Float32Array[]>;
  modelId(): string;
}
```

The retrieval layer will combine lexical and vector results. Optional Chrome built-in local AI may later do query expansion or evidence extraction, but core review must work without it.
