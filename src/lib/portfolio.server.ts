import fs from "fs/promises";
import path from "path";

export type PortfolioEntry = {
  id: string;
  title: string;
  description?: string;
  coverImage: string;
  images: string[];
  createdAt: string;
};

const portfolioFile = path.join(process.cwd(), "portfolio.json");
const uploadsRoot = path.join(process.cwd(), "public", "uploads", "portfolio");

function sanitizeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-").replace(/-+/g, "-");
}

function normalizePortfolioEntry(raw: unknown): PortfolioEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;

  const id = String(item.id ?? "").trim();
  const title = String(item.title ?? "").trim();
  const coverImage = String(item.coverImage ?? "").trim();
  if (!id || !title || !coverImage) return null;

  const images = Array.isArray(item.images)
    ? item.images
        .filter((v): v is string => typeof v === "string")
        .map((v) => v.trim())
        .filter(Boolean)
    : [];

  return {
    id,
    title,
    description: typeof item.description === "string" ? item.description.trim() || undefined : undefined,
    coverImage,
    images: images.length ? images : [coverImage],
    createdAt:
      typeof item.createdAt === "string" && item.createdAt.trim()
        ? item.createdAt.trim()
        : new Date(0).toISOString(),
  };
}

export async function readPortfolio(): Promise<PortfolioEntry[]> {
  try {
    const raw = await fs.readFile(portfolioFile, "utf8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    const items = parsed
      .map((entry) => normalizePortfolioEntry(entry))
      .filter((entry): entry is PortfolioEntry => Boolean(entry));

    return items.sort((a, b) => {
      const aMs = Date.parse(a.createdAt);
      const bMs = Date.parse(b.createdAt);
      const safeA = Number.isFinite(aMs) ? aMs : 0;
      const safeB = Number.isFinite(bMs) ? bMs : 0;
      return safeB - safeA;
    });
  } catch {
    return [];
  }
}

async function writePortfolio(items: PortfolioEntry[]) {
  await fs.writeFile(portfolioFile, JSON.stringify(items, null, 2), "utf8");
}

export async function upsertPortfolioEntry(entry: PortfolioEntry) {
  const current = await readPortfolio();
  const next = [entry, ...current.filter((item) => item.id !== entry.id)];
  await writePortfolio(next);
  return next;
}

export async function deletePortfolioEntry(id: string) {
  const current = await readPortfolio();
  const next = current.filter((item) => item.id !== id);
  await writePortfolio(next);
  return next;
}

export async function savePortfolioAssets(entryId: string, files: File[]) {
  if (files.length === 0) return [];

  const safeId = sanitizeSegment(entryId || "portfolio");
  const destRoot = path.join(uploadsRoot, safeId);
  await fs.mkdir(destRoot, { recursive: true });

  const savedPaths: string[] = [];

  for (const file of files) {
    const incoming = file.name || "asset";
    const cleaned = incoming
      .split(/[\\/]+/)
      .filter(Boolean)
      .map((segment) => sanitizeSegment(segment));
    const relPath = cleaned.length ? cleaned.join("/") : "asset";
    const absPath = path.join(destRoot, relPath);

    await fs.mkdir(path.dirname(absPath), { recursive: true });
    const bytes = new Uint8Array(await file.arrayBuffer());
    await fs.writeFile(absPath, bytes);

    savedPaths.push(`/uploads/portfolio/${safeId}/${relPath.replace(/\\/g, "/")}`);
  }

  return savedPaths;
}