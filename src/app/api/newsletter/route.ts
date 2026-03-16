import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function POST(req: Request) {
  const { email } = await req.json();

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required." }, { status: 400 });
  }

  const file = path.join(process.cwd(), "newsletter.json");

  let list: string[] = [];
  try {
    const raw = await fs.readFile(file, "utf8");
    list = JSON.parse(raw);
    if (!Array.isArray(list)) list = [];
  } catch {
    // file may not exist yet
  }

  const normalized = email.trim().toLowerCase();
  if (!list.includes(normalized)) {
    list.push(normalized);
    await fs.writeFile(file, JSON.stringify(list, null, 2), "utf8");
  }

  return NextResponse.json({ ok: true });
}