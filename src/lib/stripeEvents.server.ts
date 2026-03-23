import { readJsonStore, writeJsonStore } from "@/lib/storage.server";

const processedEventsStorePath = "stripe-events.json";

async function readProcessedEventIds() {
  const parsed = await readJsonStore<unknown[]>(processedEventsStorePath, []);
  if (!Array.isArray(parsed)) return [];

  return parsed.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
}

export async function hasProcessedStripeEvent(eventId: string) {
  const ids = await readProcessedEventIds();
  return ids.includes(eventId);
}

export async function markStripeEventProcessed(eventId: string) {
  const ids = await readProcessedEventIds();
  if (ids.includes(eventId)) return ids;

  const next = [eventId, ...ids].slice(0, 500);
  await writeJsonStore(processedEventsStorePath, next);
  return next;
}
