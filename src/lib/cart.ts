// src/lib/cart.ts
import type { Product } from "./products";
import { ONE_OF_ONE_SIZE } from "./product-options";

export type CartItem = {
  productId: string;
  size: string;
  qty: number;
};

type ProductStock = Pick<Product, "id" | "quantity">;

const KEY = "bag_cart_v1";
const EVT = "bag:cart";
const EMPTY_CART: CartItem[] = [];

let cachedRawCart: string | null | undefined;
let cachedSnapshot: CartItem[] = EMPTY_CART;

function cartLineKey(productId: string, size: string) {
  return `${productId}::${size}`;
}

function resolveCartSize(product: Product, size?: string) {
  const normalized = size?.trim();
  if (normalized) return normalized;

  const firstSize = product.sizes?.find((value) => value.trim());
  return firstSize || ONE_OF_ONE_SIZE;
}

function storageGet(key: string) {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string) {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function storageRemove(key: string) {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function emitCartUpdate() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(EVT));
  } catch {}
}

function safeParse(raw: string | null): CartItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const merged = new Map<string, CartItem>();

    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;

      const item = entry as { productId?: unknown; size?: unknown; qty?: unknown };
      const productId = typeof item.productId === "string" ? item.productId.trim() : "";
      const size = typeof item.size === "string" ? item.size.trim() : "";
      const qty = Number(item.qty);

      if (!productId || !Number.isFinite(qty) || qty <= 0) continue;

      const key = cartLineKey(productId, size);
      const existing = merged.get(key);
      if (existing) {
        existing.qty += Math.floor(qty);
      } else {
        merged.set(key, { productId, size, qty: Math.floor(qty) });
      }
    }

    return [...merged.values()];
  } catch {
    return [];
  }
}

export function getCartSnapshot(): CartItem[] {
  const raw = storageGet(KEY);

  if (raw === cachedRawCart) {
    return cachedSnapshot;
  }

  const parsed = safeParse(raw);
  cachedRawCart = raw;
  cachedSnapshot = parsed.length ? parsed : EMPTY_CART;
  return cachedSnapshot;
}

export function getEmptyCartSnapshot(): CartItem[] {
  return EMPTY_CART;
}

export function getCart(): CartItem[] {
  return getCartSnapshot().map((item) => ({ ...item }));
}

export function setCart(items: CartItem[]) {
  const raw = JSON.stringify(items);
  if (storageSet(KEY, raw)) {
    cachedRawCart = raw;
    const parsed = safeParse(raw);
    cachedSnapshot = parsed.length ? parsed : EMPTY_CART;
    emitCartUpdate();
  }
}

export function addToCart(product: Product, size: string, qty = 1) {
  const items = getCart();
  const resolvedSize = resolveCartSize(product, size);
  const found = items.find((i) => i.productId === product.id && i.size === resolvedSize);
  const maxQty = typeof product.quantity === "number" ? Math.max(0, Math.floor(product.quantity)) : undefined;
  const currentProductQty = items
    .filter((item) => item.productId === product.id)
    .reduce((sum, item) => sum + item.qty, 0);

  if (found) {
    const nextQty = found.qty + Math.max(1, Math.floor(qty));
    const maxLineQty =
      typeof maxQty === "number" ? Math.max(0, maxQty - (currentProductQty - found.qty)) : undefined;
    found.qty = typeof maxLineQty === "number" ? Math.min(nextQty, maxLineQty) : nextQty;
  } else {
    const nextQty = Math.max(1, Math.floor(qty));
    const maxLineQty = typeof maxQty === "number" ? Math.max(0, maxQty - currentProductQty) : undefined;
    const normalizedQty = typeof maxLineQty === "number" ? Math.min(nextQty, maxLineQty) : nextQty;
    if (normalizedQty > 0) {
      items.push({ productId: product.id, size: resolvedSize, qty: normalizedQty });
    }
  }
  setCart(items); // emits update
}

export function setCartItemQty(productId: string, size: string, qty: number, maxQty?: number) {
  const items = getCart();
  const index = items.findIndex((i) => i.productId === productId && i.size === size);

  if (index === -1) return;

  const normalizedMax =
    typeof maxQty === "number" && Number.isFinite(maxQty) ? Math.max(0, Math.floor(maxQty)) : undefined;
  const otherQty = items
    .filter((item, itemIndex) => item.productId === productId && itemIndex !== index)
    .reduce((sum, item) => sum + item.qty, 0);
  const maxLineQty =
    typeof normalizedMax === "number" ? Math.max(0, normalizedMax - otherQty) : undefined;
  const targetQty = Math.max(
    0,
    typeof maxLineQty === "number" ? Math.min(Math.floor(qty), maxLineQty) : Math.floor(qty)
  );

  if (targetQty <= 0) {
    items.splice(index, 1);
  } else {
    items[index].qty = targetQty;
  }

  setCart(items); // emits update
}

export function getCartItemQty(productId: string, size?: string) {
  return getCart()
    .filter((item) => item.productId === productId && (typeof size === "string" ? item.size === size : true))
    .reduce((sum, item) => sum + item.qty, 0);
}

export function reconcileCartQuantities(products: ProductStock[]) {
  const items = getCart();
  if (!items.length) return;

  const stockById = new Map(
    products.map((product) => [product.id, typeof product.quantity === "number" ? Math.max(0, Math.floor(product.quantity)) : undefined])
  );

  let changed = false;
  const next: CartItem[] = [];
  const remainingById = new Map<string, number>();

  for (const item of items) {
    if (!stockById.has(item.productId)) {
      // Some callers only reconcile a subset of products.
      // Preserve unrelated cart items instead of dropping them.
      next.push(item);
      continue;
    }

    const maxQty = stockById.get(item.productId);
    if (typeof maxQty !== "number") {
      next.push(item);
      continue;
    }

    const remainingStock = remainingById.has(item.productId)
      ? remainingById.get(item.productId) ?? 0
      : maxQty;
    const clampedQty = Math.max(0, Math.min(item.qty, remainingStock));
    remainingById.set(item.productId, Math.max(0, remainingStock - clampedQty));

    if (clampedQty !== item.qty) changed = true;
    if (clampedQty > 0) {
      next.push({ ...item, qty: clampedQty });
    } else {
      changed = true;
    }
  }

  if (changed) {
    setCart(next);
  }
}

export function removeFromCart(productId: string, size: string) {
  const items = getCart().filter((i) => !(i.productId === productId && i.size === size));
  setCart(items); // emits update
}

export function clearCart() {
  if (storageRemove(KEY)) {
    cachedRawCart = null;
    cachedSnapshot = EMPTY_CART;
    emitCartUpdate();
  }
}

export function cartCount() {
  return getCart().reduce((sum, i) => sum + i.qty, 0);
}
