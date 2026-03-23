// src/lib/cart.ts
import type { Product } from "./products";

export type CartItem = {
  productId: string;
  qty: number;
};

type ProductStock = Pick<Product, "id" | "quantity">;

const KEY = "bag_cart_v1";
const EVT = "bag:cart";
const EMPTY_CART: CartItem[] = [];

let cachedRawCart: string | null | undefined;
let cachedSnapshot: CartItem[] = EMPTY_CART;

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

    const merged = new Map<string, number>();

    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;

      const item = entry as { productId?: unknown; qty?: unknown };
      const productId = typeof item.productId === "string" ? item.productId.trim() : "";
      const qty = Number(item.qty);

      if (!productId || !Number.isFinite(qty) || qty <= 0) continue;
      merged.set(productId, (merged.get(productId) ?? 0) + Math.floor(qty));
    }

    return [...merged.entries()].map(([productId, qty]) => ({ productId, qty }));
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

export function addToCart(product: Product, qty = 1) {
  const items = getCart();
  const found = items.find((i) => i.productId === product.id);
  const maxQty = typeof product.quantity === "number" ? Math.max(0, Math.floor(product.quantity)) : undefined;

  if (found) {
    const nextQty = found.qty + Math.max(1, Math.floor(qty));
    found.qty = typeof maxQty === "number" ? Math.min(nextQty, maxQty) : nextQty;
  } else {
    const nextQty = Math.max(1, Math.floor(qty));
    const normalizedQty = typeof maxQty === "number" ? Math.min(nextQty, maxQty) : nextQty;
    if (normalizedQty > 0) {
      items.push({ productId: product.id, qty: normalizedQty });
    }
  }
  setCart(items); // emits update
}

export function setCartItemQty(productId: string, qty: number, maxQty?: number) {
  const normalizedMax =
    typeof maxQty === "number" && Number.isFinite(maxQty) ? Math.max(0, Math.floor(maxQty)) : undefined;
  const targetQty = Math.max(
    0,
    typeof normalizedMax === "number" ? Math.min(Math.floor(qty), normalizedMax) : Math.floor(qty)
  );
  const items = getCart();
  const index = items.findIndex((i) => i.productId === productId);

  if (index === -1) return;

  if (targetQty <= 0) {
    items.splice(index, 1);
  } else {
    items[index].qty = targetQty;
  }

  setCart(items); // emits update
}

export function getCartItemQty(productId: string) {
  return getCart().find((item) => item.productId === productId)?.qty ?? 0;
}

export function reconcileCartQuantities(products: ProductStock[]) {
  const items = getCart();
  if (!items.length) return;

  const stockById = new Map(
    products.map((product) => [product.id, typeof product.quantity === "number" ? Math.max(0, Math.floor(product.quantity)) : undefined])
  );

  let changed = false;
  const next: CartItem[] = [];

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

    const clampedQty = Math.max(0, Math.min(item.qty, maxQty));
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

export function removeFromCart(productId: string) {
  const items = getCart().filter((i) => i.productId !== productId);
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
