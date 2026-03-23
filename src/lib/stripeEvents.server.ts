import { readJsonStore, writeJsonStore } from "@/lib/storage.server";

const processedEventsStorePath = "stripe-events.json";

async function readProcessedKeys() {
  const parsed = await readJsonStore<unknown[]>(processedEventsStorePath, []);
  if (!Array.isArray(parsed)) return [];

  return parsed.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

function toSessionFulfillmentKey(sessionId: string) {
  return `checkout_session:${sessionId.trim()}`;
}

export async function hasProcessedStripeSession(sessionId: string) {
  const key = toSessionFulfillmentKey(sessionId);
  const ids = await readProcessedKeys();
  return ids.includes(key);
}

export async function markStripeSessionProcessed(sessionId: string) {
  const key = toSessionFulfillmentKey(sessionId);
  const ids = await readProcessedKeys();
  if (ids.includes(key)) return ids;

  const next = [key, ...ids].slice(0, 500);
  await writeJsonStore(processedEventsStorePath, next);
  return next;
}
