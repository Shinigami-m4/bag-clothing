import type { Product, SizeQuantities } from "./products";

function normalizeSizeKey(size: unknown) {
  return typeof size === "string" ? size.trim() : "";
}

export function normalizeStockQuantity(value: unknown) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity) || quantity < 0) return 0;
  return Math.floor(quantity);
}

export function buildSizeQuantities(
  sizes: string[],
  input: unknown,
  fallbackTotal = 0
): SizeQuantities {
  const normalizedSizes = [...new Set(sizes.map(normalizeSizeKey).filter(Boolean))];
  const sizeSet = new Set(normalizedSizes);
  const next: SizeQuantities = Object.fromEntries(normalizedSizes.map((size) => [size, 0]));

  let matchedInput = false;
  if (input && typeof input === "object" && !Array.isArray(input)) {
    for (const [rawSize, rawQty] of Object.entries(input as Record<string, unknown>)) {
      const size = normalizeSizeKey(rawSize);
      if (!sizeSet.has(size)) continue;
      next[size] = normalizeStockQuantity(rawQty);
      matchedInput = true;
    }
  }

  if (!matchedInput && normalizedSizes.length > 0) {
    next[normalizedSizes[0]] = normalizeStockQuantity(fallbackTotal);
  }

  return next;
}

export function sumSizeQuantities(sizeQuantities: SizeQuantities | null | undefined) {
  if (!sizeQuantities) return 0;
  return Object.values(sizeQuantities).reduce((sum, qty) => sum + normalizeStockQuantity(qty), 0);
}

export function getProductQuantity(
  product: Pick<Product, "quantity" | "sizeQuantities">
) {
  if (product.sizeQuantities) {
    return sumSizeQuantities(product.sizeQuantities);
  }

  return normalizeStockQuantity(product.quantity);
}

export function getProductSizeQuantity(
  product: Pick<Product, "sizes" | "quantity" | "sizeQuantities">,
  size: string
) {
  const normalizedSize = normalizeSizeKey(size);
  if (!normalizedSize) return 0;

  if (product.sizeQuantities && Object.hasOwn(product.sizeQuantities, normalizedSize)) {
    return normalizeStockQuantity(product.sizeQuantities[normalizedSize]);
  }

  const normalizedSizes = [...new Set((product.sizes ?? []).map(normalizeSizeKey).filter(Boolean))];
  if (normalizedSizes.length === 1 && normalizedSizes[0] === normalizedSize) {
    return normalizeStockQuantity(product.quantity);
  }

  return 0;
}

export function formatSizeQuantitySummary(
  product: Pick<Product, "sizes" | "quantity" | "sizeQuantities">
) {
  const normalizedSizes = [...new Set((product.sizes ?? []).map(normalizeSizeKey).filter(Boolean))];
  return normalizedSizes.map((size) => `${size}: ${getProductSizeQuantity(product, size)}`).join(" | ");
}
