import { NextResponse } from "next/server";
import { artistConfig } from "@/lib/artists";
import {
  deleteInventoryProduct,
  readInventory,
  saveProductAssets,
  upsertInventoryProduct,
  type InventoryProduct,
} from "@/lib/inventory.server";
import {
  getDefaultSizesForCategory,
  isProductCategory,
  normalizeProductCategory,
  normalizeProductSizes,
  type ProductCategory,
} from "@/lib/product-options";
import { buildSizeQuantities, getProductQuantity } from "@/lib/product-stock";

function toInt(value: unknown, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}

function isArtistId(input: string): input is keyof typeof artistConfig {
  return input in artistConfig;
}

function parseCategory(
  value: unknown,
  fallback: ProductCategory | undefined,
  hint: string
): ProductCategory {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (isProductCategory(normalized)) return normalized;
  if (fallback) return fallback;
  return normalizeProductCategory(value, hint);
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

function parseSizeQuantities(value: unknown) {
  if (!value) return undefined;
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return value && typeof value === "object" && !Array.isArray(value) ? value : undefined;
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
      const category = parseCategory(form.get("category"), existing?.category, `${id} ${name}`);
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
        category,
        priceCents: toInt(form.get("priceCents"), existing?.priceCents ?? 0),
        sizes: form.has("sizes")
          ? normalizeProductSizes(form.getAll("sizes"), category)
          : existing?.sizes ?? getDefaultSizesForCategory(category),
        description: String(form.get("description") || "").trim() || undefined,
        isPublished: toPublished(form.get("isPublished"), existing?.isPublished ?? false),
        image,
        images: uploaded.length ? uploaded : existing?.images,
        sizeQuantities: {},
        quantity: 0,
      };

      item.sizeQuantities = buildSizeQuantities(
        item.sizes,
        parseSizeQuantities(form.get("sizeQuantities")),
        toInt(form.get("quantity"), existing?.quantity ?? 0)
      );
      item.quantity = getProductQuantity(item);

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
    const category = parseCategory(body?.category, existing?.category, `${id} ${name}`);

    const item: InventoryProduct = {
      id,
      name,
      artist,
      category,
      image: required(String(body?.image || existing?.image || ""), "image"),
      priceCents: toInt(body?.priceCents, existing?.priceCents ?? 0),
      sizes:
        body && Object.hasOwn(body, "sizes")
          ? normalizeProductSizes(body?.sizes, category)
          : existing?.sizes ?? getDefaultSizesForCategory(category),
      description:
        body && Object.hasOwn(body, "description")
          ? String(body?.description || "").trim() || undefined
          : existing?.description,
      isPublished: toPublished(body?.isPublished, existing?.isPublished ?? false),
      images: Array.isArray(body?.images)
        ? body.images.map((x: unknown) => String(x)).filter(Boolean)
        : existing?.images,
      sizeQuantities: {},
      quantity: 0,
    };

    item.sizeQuantities = buildSizeQuantities(
      item.sizes,
      body && Object.hasOwn(body, "sizeQuantities") ? parseSizeQuantities(body?.sizeQuantities) : existing?.sizeQuantities,
      toInt(body?.quantity, existing?.quantity ?? 0)
    );
    item.quantity = getProductQuantity(item);

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
