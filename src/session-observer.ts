import { sanitizeObservation, validateObservation, type Observation } from './session-diagnostics.js';

/** Passive, opt-in MAIN-world observer. It never sends a request or changes one. */
(() => {
  const channel = 'cautious-review-session-diagnostics';
  const maxBodyBytes = 1_000_000;
  const maxObservations = 100;
  const maxDurationMs = 10 * 60 * 1000;
  const global = window as Window & { __cautiousReviewObserverInstalled?: boolean };
  if (global.__cautiousReviewObserverInstalled) return;
  global.__cautiousReviewObserverInstalled = true;

  let active = false;
  let generation = 0;
  let count = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let requestInfo = new WeakMap<XMLHttpRequest, { method: string; url: string; json: boolean; generation: number }>();
  const readers = new Set<ReadableStreamDefaultReader<Uint8Array>>();
  let originalFetch: typeof window.fetch | undefined;
  let wrappedFetch: typeof window.fetch | undefined;
  let originalOpen: typeof XMLHttpRequest.prototype.open | undefined;
  let wrappedOpen: typeof XMLHttpRequest.prototype.open | undefined;
  let originalSend: typeof XMLHttpRequest.prototype.send | undefined;
  let wrappedSend: typeof XMLHttpRequest.prototype.send | undefined;
  let originalSetRequestHeader: typeof XMLHttpRequest.prototype.setRequestHeader | undefined;
  let wrappedSetRequestHeader: typeof XMLHttpRequest.prototype.setRequestHeader | undefined;

  function post(value: unknown) {
    try { window.postMessage({ channel, ...value as object }, location.origin); } catch { /* diagnostics must never affect the page */ }
  }

  function isCurrent(ticket: number) { return active && generation === ticket; }

  function sameOriginHttps(raw: string): string | undefined {
    try {
      const url = new URL(raw, location.href);
      if (url.protocol !== 'https:' || url.origin !== location.origin || url.username || url.password || url.port) return undefined;
      return url.href;
    } catch { return undefined; }
  }

  function restore() {
    if (wrappedFetch && window.fetch === wrappedFetch && originalFetch) window.fetch = originalFetch;
    const proto = XMLHttpRequest.prototype;
    if (wrappedOpen && proto.open === wrappedOpen && originalOpen) proto.open = originalOpen;
    if (wrappedSend && proto.send === wrappedSend && originalSend) proto.send = originalSend;
    if (wrappedSetRequestHeader && proto.setRequestHeader === wrappedSetRequestHeader && originalSetRequestHeader) proto.setRequestHeader = originalSetRequestHeader;
    originalFetch = wrappedFetch = undefined;
    originalOpen = wrappedOpen = undefined;
    originalSend = wrappedSend = undefined;
    originalSetRequestHeader = wrappedSetRequestHeader = undefined;
  }

  function stop(notify = true) {
    const wasActive = active;
    active = false;
    generation++;
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    count = 0;
    requestInfo = new WeakMap();
    restore();
    for (const reader of readers) void reader.cancel().catch(() => undefined);
    readers.clear();
    if (notify && wasActive) post({ kind: 'state', active: false });
  }

  function emit(input: unknown, ticket: number) {
    if (!isCurrent(ticket) || count >= maxObservations) return;
    try {
      const observation = validateObservation(input);
      if (!observation || !isCurrent(ticket)) return;
      count++;
      post({ kind: 'observation', observation });
      if (count >= maxObservations) stop();
    } catch { /* malformed/unexpected page data is ignored */ }
  }

  function combine(request: Observation | null, response: Observation | null): Observation | null {
    const base = response ?? request;
    if (!base) return null;
    return validateObservation({
      method: base.method, pathTemplate: base.pathTemplate, queryKeys: base.queryKeys,
      ...(response?.status === undefined ? {} : { status: response.status }),
      requestSchema: request?.requestSchema ?? null,
      responseSchema: response?.responseSchema ?? null,
    });
  }

  function jsonContentType(raw: string | null | undefined): boolean {
    return typeof raw === 'string' && /^\s*application\/(?:[a-z0-9.+-]*\+)?json\b/i.test(raw);
  }

  function contentType(headers: HeadersInit | undefined, fallback?: Headers): string | null {
    try {
      if (headers !== undefined) return new Headers(headers).get('content-type');
      return fallback?.get('content-type') ?? null;
    } catch { return null; }
  }

  function parseJson(text: string | undefined): unknown {
    if (text === undefined || text.length > maxBodyBytes) return undefined;
    try { return JSON.parse(text); } catch { return undefined; }
  }

  async function readJsonStream(stream: ReadableStream<Uint8Array> | null, ticket: number): Promise<unknown> {
    if (!stream || !isCurrent(ticket)) return undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      reader = stream.getReader();
      readers.add(reader);
      while (isCurrent(ticket)) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBodyBytes) {
          void reader.cancel().catch(() => undefined);
          return undefined;
        }
        chunks.push(value);
      }
      if (!isCurrent(ticket)) return undefined;
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return parseJson(new TextDecoder().decode(bytes));
    } catch { return undefined; }
    finally {
      if (reader) {
        readers.delete(reader);
        try { reader.releaseLock(); } catch { /* cancelled/closed reader */ }
      }
      chunks.length = 0;
    }
  }

  async function fetchRequestBody(input: RequestInfo | URL, init: RequestInit | undefined, ticket: number): Promise<unknown> {
    if (!isCurrent(ticket)) return undefined;
    if (init?.body !== undefined && init.body !== null) {
      const requestHeaders = typeof Request !== 'undefined' && input instanceof Request ? input.headers : undefined;
      if (!jsonContentType(contentType(init.headers, requestHeaders))) return undefined;
      if (typeof init.body === 'string') return parseJson(init.body);
      if (init.body instanceof Blob && init.body.size <= maxBodyBytes && jsonContentType(init.body.type)) {
        try { return parseJson(await init.body.text()); } catch { return undefined; }
      }
      return undefined;
    }
    if (typeof Request !== 'undefined' && input instanceof Request && jsonContentType(input.headers.get('content-type'))) {
      try { return await readJsonStream(input.clone().body, ticket); } catch { return undefined; }
    }
    return undefined;
  }

  async function fetchResponseBody(response: Response, ticket: number): Promise<unknown> {
    if (!isCurrent(ticket) || !jsonContentType(response.headers.get('content-type'))) return undefined;
    try { return await readJsonStream(response.clone().body, ticket); } catch { return undefined; }
  }

  function patch() {
    const patchGeneration = generation;
    const fetchFunction = window.fetch;
    originalFetch = fetchFunction;
    wrappedFetch = function(this: Window, input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      const result = Reflect.apply(fetchFunction, this, [input, init]);
      try {
        if (isCurrent(patchGeneration)) {
          const rawUrl = typeof input === 'string' || input instanceof URL ? String(input) : input.url;
          const url = sameOriginHttps(rawUrl);
          if (!url) return result;
          const ticket = patchGeneration;
          const method = String(init?.method ?? (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')).toUpperCase();
          const requestObservation = fetchRequestBody(input, init, ticket).then(
            body => sanitizeObservation({ method, url, ...(body !== undefined ? { requestBody: body } : {}) }),
            () => sanitizeObservation({ method, url }),
          );
          void Promise.resolve(result).then(async response => {
            try {
              const request = await requestObservation;
              const responseBody = await fetchResponseBody(response, ticket);
              const observed = sanitizeObservation({ method, url, status: response.status, ...(responseBody !== undefined ? { responseBody } : {}) });
              if (isCurrent(ticket)) emit(combine(request, observed), ticket);
            } catch { /* passive observer */ }
          }, async () => {
            try {
              const request = await requestObservation;
              if (isCurrent(ticket)) emit(request, ticket);
            } catch { /* passive observer */ }
          });
        }
      } catch { /* observer failures never change the original fetch result */ }
      return result;
    };
    window.fetch = wrappedFetch;

    const proto = XMLHttpRequest.prototype;
    const openFunction = proto.open;
    originalOpen = openFunction;
    wrappedOpen = function(this: XMLHttpRequest, method: string, url: string | URL, ...args: unknown[]) {
      const result = Reflect.apply(openFunction, this, [method, url, ...args]);
      try {
        const normalized = sameOriginHttps(String(url));
        if (isCurrent(patchGeneration) && normalized) requestInfo.set(this, { method: String(method).toUpperCase(), url: normalized, json: false, generation: patchGeneration });
        else requestInfo.delete(this);
      } catch { /* observation must not change XHR behavior */ }
      return result;
    } as typeof proto.open;
    proto.open = wrappedOpen;

    const setRequestHeaderFunction = proto.setRequestHeader;
    originalSetRequestHeader = setRequestHeaderFunction;
    wrappedSetRequestHeader = function(this: XMLHttpRequest, name: string, value: string) {
      const info = requestInfo.get(this);
      if (info && typeof name === 'string' && name.toLowerCase() === 'content-type' && typeof value === 'string') info.json = jsonContentType(value);
      return Reflect.apply(setRequestHeaderFunction, this, [name, value]);
    };
    proto.setRequestHeader = wrappedSetRequestHeader;

    const sendFunction = proto.send;
    originalSend = sendFunction;
    wrappedSend = function(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
      try {
        const info = requestInfo.get(this);
        if (isCurrent(patchGeneration) && info && info.generation === patchGeneration) {
          const ticket = info.generation;
          let request: Observation | null;
          {
            const requestBody = info.json && typeof body === 'string' ? parseJson(body) : undefined;
            request = sanitizeObservation({ method: info.method, url: info.url, ...(requestBody !== undefined ? { requestBody } : {}) });
          }
          this.addEventListener('loadend', () => {
            try {
              if (!isCurrent(ticket)) return;
              let responseBody: unknown;
              if (jsonContentType(this.getResponseHeader('content-type'))) {
                if (this.responseType === '' || this.responseType === 'text') {
                  const text = this.responseText;
                  if (text.length <= maxBodyBytes) responseBody = parseJson(text);
                }
                // responseType=json is omitted: there is no bounded raw JSON byte
                // representation to clone without serializing a possibly huge object.
              }
              const status = this.status;
              const response = sanitizeObservation({ method: info.method, url: info.url, ...(status >= 100 && status <= 599 ? { status } : {}), ...(responseBody !== undefined ? { responseBody } : {}) });
              emit(combine(request, response), ticket);
            } catch { /* page XHR remains untouched */ }
          }, { once: true });
        }
      } catch { /* observer failures never prevent the original send */ }
      return Reflect.apply(sendFunction, this, [body]);
    };
    proto.send = wrappedSend;
  }

  function start() {
    if (active) { post({ kind: 'state', active: true }); return; }
    active = true;
    generation++;
    count = 0;
    const ticket = generation;
    try { patch(); }
    catch { stop(false); post({ kind: 'state', active: false }); return; }
    timer = setTimeout(() => { if (isCurrent(ticket)) stop(); }, maxDurationMs);
    post({ kind: 'state', active: true });
  }

  window.addEventListener('click', event => {
    if (!event.isTrusted) return;
    const path = event.composedPath();
    const host = path.find((node): node is HTMLElement => node instanceof HTMLElement && node.id === 'cautious-review');
    const button = path.find((node): node is HTMLButtonElement => node instanceof HTMLButtonElement && node.id === 'session-start');
    if (host && button && host.shadowRoot?.querySelector('#session-start') === button) start();
  }, true);
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.channel !== channel) return;
    // Stop is safe to accept from the extension UI bridge; start requires the
    // trusted click above and cannot be forged with page postMessage.
    if (event.data.command === 'stop') stop();
  });
  window.addEventListener('pagehide', () => stop(false), { once: true });
})();
