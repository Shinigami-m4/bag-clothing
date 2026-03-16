import fs from "fs/promises";
import path from "path";

const processedEventsFile = path.join(process.cwd(), "stripe-events.json");

async function readProcessedEventIds() {
  try {
    const raw = await fs.readFile(processedEventsFile, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is string => typeof value === "string" && value.trim().length > 0);
  } catch {
    return [];
  }
}

export async function hasProcessedStripeEvent(eventId: string) {
  const ids = await readProcessedEventIds();
  return ids.includes(eventId);
}

export async function markStripeEventProcessed(eventId: string) {
  const ids = await readProcessedEventIds();
  if (ids.includes(eventId)) return ids;

  const next = [eventId, ...ids].slice(0, 500);
  await fs.writeFile(processedEventsFile, JSON.stringify(next, null, 2), "utf8");
  return next;
}
