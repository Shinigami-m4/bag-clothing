const brevoContactsEndpoint = "https://api.brevo.com/v3/contacts";

function parseListIds(value: string | undefined) {
  if (!value) return [];

  return value
    .split(",")
    .map((part) => Number(part.trim()))
    .filter((part) => Number.isInteger(part) && part > 0);
}

export function isBrevoEnabled() {
  return Boolean(process.env.BREVO_API_KEY);
}

export async function subscribeEmailToBrevo(email: string) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error("BREVO_API_KEY is not configured.");
  }

  const listIds = parseListIds(
    process.env.BREVO_NEWSLETTER_LIST_IDS || process.env.BREVO_NEWSLETTER_LIST_ID,
  );

  const body: Record<string, unknown> = {
    email,
    updateEnabled: true,
  };

  if (listIds.length > 0) {
    body.listIds = listIds;
  }

  const res = await fetch(brevoContactsEndpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (res.ok) {
    return;
  }

  const details = (await res.text()).slice(0, 300);
  throw new Error(`Brevo contact sync failed (${res.status}): ${details}`);
}
