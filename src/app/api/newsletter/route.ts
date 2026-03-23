import { NextResponse } from "next/server";
import { isBrevoEnabled, subscribeEmailToBrevo } from "@/lib/brevo.server";
import { readJsonStore, writeJsonStore } from "@/lib/storage.server";

const newsletterStorePath = "newsletter.json";

export async function POST(req: Request) {
  const { email } = await req.json();

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required." }, { status: 400 });
  }

  const normalized = email.trim().toLowerCase();

  try {
    if (isBrevoEnabled()) {
      await subscribeEmailToBrevo(normalized);
      return NextResponse.json({ ok: true, provider: "brevo" });
    }

    const list = await readJsonStore<unknown[]>(newsletterStorePath, []);
    const emails = Array.isArray(list)
      ? list.filter((value): value is string => typeof value === "string")
      : [];

    if (!emails.includes(normalized)) {
      emails.push(normalized);
      await writeJsonStore(newsletterStorePath, emails);
    }

    return NextResponse.json({ ok: true, provider: "local" });
  } catch (error) {
    console.error("Newsletter signup failed", error);
    return NextResponse.json(
      { error: "Newsletter signup is temporarily unavailable. Please try again later." },
      { status: 500 },
    );
  }
}
