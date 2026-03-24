import { artistConfig, type ArtistId } from "@/lib/artists";
import { products, type Product } from "@/lib/products";
import { readJsonStore, savePublicUpload, writeJsonStore } from "@/lib/storage.server";
import { buildProductAssetPath } from "@/lib/uploadPaths";

export type InventoryProduct = Product & {
  description?: string;
  quantity: number;
  images?: string[];
  isPublished: boolean;
};

const inventoryStorePath = "inventory.json";

function toArtistId(value: unknown): ArtistId | null {
  if (typeof value !== "string") return null;
  return value in artistConfig ? (value as ArtistId) : null;
}

function normalizeSizes(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((v): v is string => typeof v === "string")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeQuantity(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.floor(n);
}

function normalizePrice(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n);
}

function normalizePublished(value: unknown, fallback = true) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on", "published", "live"].includes(normalized)) return true;
    if (["false", "0", "no", "off", "draft", "hidden"].includes(normalized)) return false;
  }
  return fallback;
}

function normalizeInventoryItem(raw: unknown): InventoryProduct | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  if (typeof item.id !== "string" || !item.id.trim()) return null;
  if (typeof item.name !== "string" || !item.name.trim()) return null;
  if (typeof item.image !== "string" || !item.image.trim()) return null;

  const artist = toArtistId(item.artist);
  if (!artist) return null;

  const sizes = normalizeSizes(item.sizes);
  if (sizes.length === 0) sizes.push("One of One");

  return {
    id: item.id.trim(),
    name: item.name.trim(),
    artist,
    image: item.image.trim(),
    priceCents: normalizePrice(item.priceCents),
    sizes,
    description: typeof item.description === "string" ? item.description.trim() : undefined,
    quantity: normalizeQuantity(item.quantity),
    images: Array.isArray(item.images)
      ? item.images.filter((v): v is string => typeof v === "string")
      : undefined,
    isPublished: normalizePublished(item.isPublished, true),
  };
}

export async function readInventory(): Promise<InventoryProduct[]> {
  const parsed = await readJsonStore<unknown[]>(inventoryStorePath, []);
  if (!Array.isArray(parsed)) return [];

  return parsed
    .map((entry) => normalizeInventoryItem(entry))
    .filter((entry): entry is InventoryProduct => Boolean(entry));
}

async function writeInventory(items: InventoryProduct[]) {
  await writeJsonStore(inventoryStorePath, items);
}

export async function getAllProducts(): Promise<Product[]> {
  const inventory = await readInventory();
  const invById = new Set(inventory.map((p) => p.id));
  const staticWithoutOverrides = products.filter((p) => !invById.has(p.id));
  return [...inventory, ...staticWithoutOverrides];
}

export function isLiveProduct(product: Product) {
  if (typeof product.isPublished === "boolean" && !product.isPublished) return false;
  if (typeof product.quantity === "number" && product.quantity <= 0) return false;
  return true;
}

export async function getLiveProducts(): Promise<Product[]> {
  const all = await getAllProducts();
  return all.filter(isLiveProduct);
}

export async function getProductsByArtist(artist: ArtistId): Promise<Product[]> {
  const all = await getLiveProducts();
  return all.filter((p) => p.artist === artist);
}

export async function findProductById(id: string): Promise<Product | undefined> {
  const all = await getAllProducts();
  return all.find((p) => p.id === id);
}

export async function findLiveProductById(id: string): Promise<Product | undefined> {
  const all = await getLiveProducts();
  return all.find((p) => p.id === id);
}

export async function deleteInventoryProduct(id: string) {
  const current = await readInventory();
  const next = current.filter((item) => item.id !== id);
  await writeInventory(next);
  return next;
}

export async function upsertInventoryProduct(product: InventoryProduct) {
  const current = await readInventory();
  const next = [product, ...current.filter((item) => item.id !== product.id)];
  await writeInventory(next);
  return next;
}

export async function decrementInventoryProductQuantities(lines: Array<{ productId: string; qty: number }>) {
  const current = await readInventory();
  const next = [...current];
  let changed = false;

  for (const line of lines) {
    const productId = String(line.productId || "").trim();
    const qty = Math.max(0, Math.floor(Number(line.qty) || 0));
    if (!productId || qty <= 0) continue;

    const existingIndex = next.findIndex((item) => item.id === productId);
    if (existingIndex >= 0) {
      const existing = next[existingIndex];
      const updatedQty = Math.max(0, existing.quantity - qty);
      if (updatedQty !== existing.quantity) {
        next[existingIndex] = { ...existing, quantity: updatedQty };
        changed = true;
      }
      continue;
    }

    const seeded = products.find((item) => item.id === productId);
    if (!seeded) continue;

    next.unshift({
      ...seeded,
      sizes: seeded.sizes?.length ? seeded.sizes : ["One of One"],
      quantity: Math.max(0, (seeded.quantity ?? 0) - qty),
      isPublished: typeof seeded.isPublished === "boolean" ? seeded.isPublished : true,
    });
    changed = true;
  }

  if (changed) {
    await writeInventory(next);
  }

  return next;
}

export async function saveProductAssets(productId: string, files: File[]) {
  if (files.length === 0) return [];

  const savedPaths: string[] = [];

  for (const file of files) {
    const incoming =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name || "asset";
    savedPaths.push(await savePublicUpload(buildProductAssetPath(productId, incoming), file));
  }

  return savedPaths;
}
