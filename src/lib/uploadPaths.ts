export function sanitizeUploadSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

function sanitizeRelativeUploadPath(value: string) {
  const cleaned = value
    .split(/[\\/]+/)
    .filter(Boolean)
    .map((segment) => sanitizeUploadSegment(segment));

  return cleaned.length ? cleaned.join("/") : "asset";
}

export function buildProductAssetPath(productId: string, originalPath: string) {
  const safeId = sanitizeUploadSegment(productId || "product");
  return `uploads/${safeId}/${sanitizeRelativeUploadPath(originalPath)}`;
}

export function buildPortfolioAssetPath(entryId: string, originalPath: string) {
  const safeId = sanitizeUploadSegment(entryId || "portfolio");
  return `uploads/portfolio/${safeId}/${sanitizeRelativeUploadPath(originalPath)}`;
}
