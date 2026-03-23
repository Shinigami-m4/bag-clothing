import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";

const jsonCacheSeconds = 60;
const assetCacheSeconds = 60 * 60 * 24 * 30;

function normalizePathname(value: string) {
  return value.replace(/\\/g, "/").replace(/^\/+/, "");
}

function toLocalDataPath(pathname: string) {
  return path.join(process.cwd(), normalizePathname(pathname));
}

function toLocalPublicPath(pathname: string) {
  return path.join(process.cwd(), "public", normalizePathname(pathname));
}

export function isBlobStorageEnabled() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

async function readLocalJson<T>(pathname: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(toLocalDataPath(pathname), "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function readJsonStore<T>(pathname: string, fallback: T): Promise<T> {
  const normalized = normalizePathname(pathname);

  if (isBlobStorageEnabled()) {
    const result = await get(normalized, { access: "private" });
    if (!result || result.statusCode !== 200 || !result.stream) {
      return readLocalJson(normalized, fallback);
    }

    try {
      const raw = await new Response(result.stream).text();
      return JSON.parse(raw) as T;
    } catch {
      return readLocalJson(normalized, fallback);
    }
  }

  return readLocalJson(normalized, fallback);
}

export async function writeJsonStore(pathname: string, value: unknown) {
  const normalized = normalizePathname(pathname);
  const body = JSON.stringify(value, null, 2);

  if (isBlobStorageEnabled()) {
    await put(normalized, body, {
      access: "private",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: jsonCacheSeconds,
      contentType: "application/json; charset=utf-8",
    });
    return;
  }

  const file = toLocalDataPath(normalized);
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, body, "utf8");
}

export async function savePublicUpload(
  pathname: string,
  file: File,
) {
  const normalized = normalizePathname(pathname);

  if (isBlobStorageEnabled()) {
    const blob = await put(normalized, file, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      cacheControlMaxAge: assetCacheSeconds,
      contentType: file.type || undefined,
    });
    return blob.url;
  }

  const destination = toLocalPublicPath(normalized);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const bytes = new Uint8Array(await file.arrayBuffer());
  await fs.writeFile(destination, bytes);
  return `/${normalized}`;
}
