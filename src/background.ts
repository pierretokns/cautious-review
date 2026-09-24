import { contextFor, search, validateDecision } from "./core.js";
import { clear, decide, documents, purgeExpired, reviews, saveDocument, undo } from "./storage.js";
let serial: Promise<unknown> = Promise.resolve();
// No fetch, cloud endpoints, external messaging, or Greenhouse writes in this preview.
chrome.runtime.onMessage.addListener((message, sender, respond) => {
  if (sender.id !== chrome.runtime.id || sender.frameId !== 0 || !sender.tab) return false;
  const context = contextFor(sender.url ?? "");
  const requested = contextFor(message?.url ?? "");
  if (!context || !requested || context.key !== requested.key) {
    respond({ ok: false, error: "Candidate/application context unavailable or changed" }); return false;
  }
  // Serialize writes and undo even when the reviewer presses keys rapidly.
  serial = serial.catch(() => undefined).then(async () => {
    await purgeExpired();
    switch (message.type) {
      case "context": return context;
      case "capture": {
        if (typeof message.text !== "string" || message.text.trim().length < 10 || message.text.length > 200000) throw Error("Select/paste 10–200,000 characters of résumé text");
        await saveDocument({ ...context, name: String(message.name ?? "").slice(0, 200), text: message.text, indexedAt: new Date().toISOString() });
        return { indexed: true };
      }
      case "queue": {
        if (!context.applicationId) throw Error("Application ID required: open a specific job application before queueing");
        const decision = validateDecision(message.decision, message.reason);
        await decide({ ...context, ...decision, createdAt: new Date().toISOString() }); return { queued: true };
      }
      case "undo": return { changed: await undo(context) };
      case "search": return search(String(message.query ?? "").slice(0, 1000), await documents(context.origin));
      case "list": return reviews(context.origin);
      case "clear": await clear(); return { cleared: true };
      default: throw Error("Unsupported message");
    }
  });
  serial.then(value => respond({ ok: true, value }), error => respond({ ok: false, error: error instanceof Error ? error.message : "Local operation failed" }));
  return true;
});
