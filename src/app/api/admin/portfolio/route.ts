import { NextResponse } from "next/server";
import {
  deletePortfolioEntry,
  readPortfolio,
  savePortfolioAssets,
  upsertPortfolioEntry,
  type PortfolioEntry,
} from "@/lib/portfolio.server";

function required(value: unknown, field: string) {
  const out = String(value ?? "").trim();
  if (!out) {
    throw new Error(`${field} required`);
  }
  return out;
}

function slugify(value: string) {
  const base = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "portfolio";
}

function makeId(title: string) {
  return `${slugify(title)}-${Date.now()}`;
}

export async function GET() {
  const items = await readPortfolio();
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const title = required(form.get("title"), "title");
      const id = String(form.get("id") || "").trim() || makeId(title);

      const existing = (await readPortfolio()).find((x) => x.id === id);
      const files = form
        .getAll("assets")
        .filter((f): f is File => f instanceof File && f.size > 0);
      const uploaded = await savePortfolioAssets(id, files);

      const coverImage = required(
        String(form.get("coverImage") || uploaded[0] || existing?.coverImage || ""),
        "coverImage"
      );

      const item: PortfolioEntry = {
        id,
        title,
        description: String(form.get("description") || "").trim() || undefined,
        coverImage,
        images: uploaded.length ? uploaded : existing?.images?.length ? existing.images : [coverImage],
        createdAt: existing?.createdAt || new Date().toISOString(),
      };

      const items = await upsertPortfolioEntry(item);
      return NextResponse.json({ ok: true, items, item });
    }

    const body = await req.json();
    const title = required(body?.title, "title");
    const id = String(body?.id || "").trim() || makeId(title);
    const existing = (await readPortfolio()).find((x) => x.id === id);
    const coverImage = required(String(body?.coverImage || existing?.coverImage || ""), "coverImage");

    const item: PortfolioEntry = {
      id,
      title,
      description:
        body && Object.hasOwn(body, "description")
          ? String(body.description || "").trim() || undefined
          : existing?.description,
      coverImage,
      images: Array.isArray(body?.images)
        ? body.images.map((x: unknown) => String(x).trim()).filter(Boolean)
        : existing?.images?.length
          ? existing.images
          : [coverImage],
      createdAt:
        typeof body?.createdAt === "string" && body.createdAt.trim()
          ? body.createdAt.trim()
          : existing?.createdAt || new Date().toISOString(),
    };

    const items = await upsertPortfolioEntry(item);
    return NextResponse.json({ ok: true, items, item });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "invalid request" },
      { status: 400 }
    );
  }
}

export async function DELETE(req: Request) {
  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const items = await deletePortfolioEntry(String(id));
  return NextResponse.json({ ok: true, items });
}
