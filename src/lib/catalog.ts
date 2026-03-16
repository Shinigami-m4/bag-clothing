import type { Product } from "@/lib/products";

export const SORT_VALUES = ["featured", "price-asc", "price-desc", "name-asc", "name-desc"] as const;

export type SortValue = (typeof SORT_VALUES)[number];

export function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function parsePriceParam(value: string | undefined) {
  if (!value) return undefined;

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return undefined;

  return Math.round(numeric * 100);
}

export function formatPriceParam(priceCents: number | undefined) {
  if (typeof priceCents !== "number") return "";
  return (priceCents / 100).toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

export function normalizeSortValue(value: string | undefined): SortValue {
  return SORT_VALUES.includes(value as SortValue) ? (value as SortValue) : "featured";
}

export function filterProductsByQuery(products: Product[], query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return products;

  return products.filter((product) => {
    const haystack = [
      product.name,
      product.id,
      product.artist,
      product.description ?? "",
      ...(product.sizes ?? []),
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(q);
  });
}

export function filterAndSortProducts(
  products: Product[],
  sort: SortValue,
  minPriceCents?: number,
  maxPriceCents?: number
) {
  let normalizedMin = minPriceCents;
  let normalizedMax = maxPriceCents;

  if (
    typeof normalizedMin === "number" &&
    typeof normalizedMax === "number" &&
    normalizedMin > normalizedMax
  ) {
    [normalizedMin, normalizedMax] = [normalizedMax, normalizedMin];
  }

  const filtered = products.filter((product) => {
    if (typeof normalizedMin === "number" && product.priceCents < normalizedMin) return false;
    if (typeof normalizedMax === "number" && product.priceCents > normalizedMax) return false;
    return true;
  });

  const list = [...filtered].sort((a, b) => {
    switch (sort) {
      case "price-asc":
        return a.priceCents - b.priceCents || a.name.localeCompare(b.name);
      case "price-desc":
        return b.priceCents - a.priceCents || a.name.localeCompare(b.name);
      case "name-asc":
        return a.name.localeCompare(b.name);
      case "name-desc":
        return b.name.localeCompare(a.name);
      default:
        return 0;
    }
  });

  return {
    list,
    minPriceCents: normalizedMin,
    maxPriceCents: normalizedMax,
    maxAvailablePriceCents: products.reduce((max, product) => Math.max(max, product.priceCents), 0),
  };
}
