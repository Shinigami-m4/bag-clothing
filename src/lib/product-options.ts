export const ONE_OF_ONE_SIZE = "1 of 1";
export const ONE_SIZE = "One Size";

const PRODUCT_CATEGORY_CONFIG = {
  hat: {
    label: "Hat",
    sizes: [ONE_SIZE],
  },
  shirt: {
    label: "Shirt",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
  },
  pants: {
    label: "Pants",
    sizes: ["28", "30", "32", "34", "36", "38", "40"],
  },
  outerwear: {
    label: "Outerwear",
    sizes: ["XS", "S", "M", "L", "XL", "XXL"],
  },
  accessory: {
    label: "Accessory",
    sizes: [ONE_SIZE],
  },
  other: {
    label: "Other",
    sizes: [],
  },
} as const;

export type ProductCategory = keyof typeof PRODUCT_CATEGORY_CONFIG;

export const PRODUCT_CATEGORY_VALUES = Object.keys(
  PRODUCT_CATEGORY_CONFIG
) as ProductCategory[];

const ONE_OF_ONE_ALIASES = new Set(["1 of 1", "one of one", "one-of-one", "one of a kind"]);
const ONE_SIZE_ALIASES = new Set(["one size", "os", "o/s"]);

export function isProductCategory(value: unknown): value is ProductCategory {
  return typeof value === "string" && value in PRODUCT_CATEGORY_CONFIG;
}

export function getCategoryLabel(value: ProductCategory | string | null | undefined) {
  if (value && isProductCategory(value)) {
    return PRODUCT_CATEGORY_CONFIG[value].label;
  }

  return PRODUCT_CATEGORY_CONFIG.other.label;
}

export function getCategoryBaseSizes(category: ProductCategory) {
  return [...PRODUCT_CATEGORY_CONFIG[category].sizes];
}

export function getCategorySizeOptions(category: ProductCategory) {
  return [...getCategoryBaseSizes(category), ONE_OF_ONE_SIZE];
}

export function getDefaultSizesForCategory(category: ProductCategory) {
  const baseSizes = getCategoryBaseSizes(category);
  return baseSizes.length ? baseSizes : [ONE_OF_ONE_SIZE];
}

function normalizeSizeToken(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const normalized = trimmed.toLowerCase();
  if (ONE_OF_ONE_ALIASES.has(normalized)) return ONE_OF_ONE_SIZE;
  if (ONE_SIZE_ALIASES.has(normalized)) return ONE_SIZE;

  return trimmed.toUpperCase();
}

function inferCategoryFromText(text: string): ProductCategory {
  const normalized = text.toLowerCase();

  if (/(beanie|hats?|caps?)\b/.test(normalized)) return "hat";
  if (/(shirts?|tees?|t-shirt|t-shirts|longsleeves?|long sleeve|long sleeves|tanks?)\b/.test(normalized)) {
    return "shirt";
  }
  if (/(pants?|jeans?|trousers?|shorts?)\b/.test(normalized)) return "pants";
  if (/(jackets?|hoodies?|coats?|zip-up|zip up|sweaters?)\b/.test(normalized)) return "outerwear";
  if (/(bags?|belts?|rings?|necklaces?|chains?|bracelets?|accessory|accessories)\b/.test(normalized)) {
    return "accessory";
  }

  return "other";
}

export function normalizeProductCategory(value: unknown, hint = ""): ProductCategory {
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (isProductCategory(normalized)) {
      return normalized;
    }

    if (normalized) {
      return inferCategoryFromText(normalized);
    }
  }

  return inferCategoryFromText(hint);
}

export function sortProductSizes(sizes: string[], category: ProductCategory) {
  const uniqueSizes = [...new Set(sizes.map((size) => normalizeSizeToken(size)).filter(Boolean))] as string[];
  if (uniqueSizes.includes(ONE_OF_ONE_SIZE)) return [ONE_OF_ONE_SIZE];

  const categoryOrder = new Map<string, number>(
    getCategoryBaseSizes(category).map((size, index) => [size, index])
  );

  return [...uniqueSizes].sort((left, right) => {
    const leftOrder = categoryOrder.get(left);
    const rightOrder = categoryOrder.get(right);

    if (typeof leftOrder === "number" && typeof rightOrder === "number") {
      return leftOrder - rightOrder;
    }

    if (typeof leftOrder === "number") return -1;
    if (typeof rightOrder === "number") return 1;

    return left.localeCompare(right, undefined, { numeric: true });
  });
}

export function normalizeProductSizes(value: unknown, category: ProductCategory) {
  const rawSizes = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];

  const normalized = sortProductSizes(
    rawSizes
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => entry.trim())
      .filter(Boolean),
    category
  );

  return normalized.length ? normalized : getDefaultSizesForCategory(category);
}
