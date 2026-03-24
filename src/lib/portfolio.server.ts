import { readJsonStore, savePublicUpload, writeJsonStore } from "@/lib/storage.server";
import { buildPortfolioAssetPath } from "@/lib/uploadPaths";

export type PortfolioEntry = {
  id: string;
  title: string;
  description?: string;
  coverImage: string;
  images: string[];
  createdAt: string;
};

const portfolioStorePath = "portfolio.json";

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
  const parsed = await readJsonStore<unknown[]>(portfolioStorePath, []);
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
}

async function writePortfolio(items: PortfolioEntry[]) {
  await writeJsonStore(portfolioStorePath, items);
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

  const savedPaths: string[] = [];

  for (const file of files) {
    const incoming =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name || "asset";
    savedPaths.push(await savePublicUpload(buildPortfolioAssetPath(entryId, incoming), file));
  }

  return savedPaths;
}
