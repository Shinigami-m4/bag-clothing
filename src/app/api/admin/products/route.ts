import { NextResponse } from "next/server";
import { artistConfig } from "@/lib/artists";
import {
  deleteInventoryProduct,
  readInventory,
  saveProductAssets,
  upsertInventoryProduct,
  type InventoryProduct,
} from "@/lib/inventory.server";

function parseSizes(value: unknown): string[] {
  if (Array.isArray(value)) {
    const sizes = value.map((v) => String(v).trim()).filter(Boolean);
    return sizes.length ? sizes : ["One of One"];
  }
  const raw = String(value ?? "");
  const sizes = raw
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  return sizes.length ? sizes : ["One of One"];
}

function toInt(value: unknown, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function isArtistId(input: string): input is keyof typeof artistConfig {
  return input in artistConfig;
}

function required(value: unknown, field: string) {
  const out = String(value ?? "").trim();
  if (!out) {
    throw new Error(`${field} required`);
  }
  return out;
}

function toPublished(value: unknown, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on", "published", "live"].includes(normalized)) return true;
    if (["false", "0", "no", "off", "draft", "hidden"].includes(normalized)) return false;
  }
  return fallback;
}

export async function GET() {
  const items = await readInventory();
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") || "";

  try {
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const id = required(form.get("id"), "id");
      const name = required(form.get("name"), "name");
      const artist = String(form.get("artist") || "").trim();
      if (!isArtistId(artist)) {
        return NextResponse.json({ error: "valid artist required" }, { status: 400 });
      }

      const existing = (await readInventory()).find((x) => x.id === id);
      const files = form
        .getAll("assets")
        .filter((f): f is File => f instanceof File && f.size > 0);
      const uploaded = await saveProductAssets(id, files);

      const image = required(
        String(form.get("image") || uploaded[0] || existing?.image || ""),
        "image"
      );

      const item: InventoryProduct = {
        id,
        name,
        artist,
        priceCents: toInt(form.get("priceCents"), existing?.priceCents ?? 0),
        sizes: form.has("sizes") ? parseSizes(form.get("sizes")) : existing?.sizes ?? ["One of One"],
        description: String(form.get("description") || "").trim() || undefined,
        quantity: toInt(form.get("quantity"), existing?.quantity ?? 0),
        isPublished: toPublished(form.get("isPublished"), existing?.isPublished ?? false),
        image,
        images: uploaded.length ? uploaded : existing?.images,
      };

      const items = await upsertInventoryProduct(item);
      return NextResponse.json({ ok: true, items });
    }

    const body = await req.json();
    const id = required(body?.id, "id");
    const name = required(body?.name, "name");
    const artist = String(body?.artist || "").trim();
    if (!isArtistId(artist)) {
      return NextResponse.json({ error: "valid artist required" }, { status: 400 });
    }

    const existing = (await readInventory()).find((x) => x.id === id);

    const item: InventoryProduct = {
      id,
      name,
      artist,
      image: required(String(body?.image || existing?.image || ""), "image"),
      priceCents: toInt(body?.priceCents, existing?.priceCents ?? 0),
      sizes:
        body && Object.hasOwn(body, "sizes")
          ? parseSizes(body?.sizes)
          : existing?.sizes ?? ["One of One"],
      description:
        body && Object.hasOwn(body, "description")
          ? String(body?.description || "").trim() || undefined
          : existing?.description,
      quantity: toInt(body?.quantity, existing?.quantity ?? 0),
      isPublished: toPublished(body?.isPublished, existing?.isPublished ?? false),
      images: Array.isArray(body?.images)
        ? body.images.map((x: unknown) => String(x)).filter(Boolean)
        : existing?.images,
    };

    const items = await upsertInventoryProduct(item);
    return NextResponse.json({ ok: true, items });
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
  const items = await deleteInventoryProduct(String(id));
  return NextResponse.json({ ok: true, items });
}
