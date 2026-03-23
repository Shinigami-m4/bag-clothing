import fs from "fs/promises";
import path from "path";
import { get, put } from "@vercel/blob";

const jsonCacheSeconds = 60;
const assetCacheSeconds = 60 * 60 * 24 * 30;
const legacyBlobToken = process.env.BLOB_READ_WRITE_TOKEN;
const privateBlobToken = process.env.BLOB_PRIVATE_READ_WRITE_TOKEN || legacyBlobToken;
const publicBlobToken = process.env.BLOB_PUBLIC_READ_WRITE_TOKEN || legacyBlobToken;

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
  return Boolean(privateBlobToken || publicBlobToken);
}

function isBlobAccessError(error: unknown, mode: "private" | "public") {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return message.includes(`cannot use ${mode} access`) && message.includes("store");
}

function getBlobAccessError(mode: "private" | "public") {
  if (mode === "private") {
    return new Error(
      "Blob config mismatch: set BLOB_PRIVATE_READ_WRITE_TOKEN to a private Vercel Blob store."
    );
  }

  return new Error(
    "Blob config mismatch: set BLOB_PUBLIC_READ_WRITE_TOKEN to a public Vercel Blob store."
  );
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

  if (privateBlobToken) {
    let result;
    try {
      result = await get(normalized, { access: "private", token: privateBlobToken });
    } catch (error) {
      if (isBlobAccessError(error, "private")) {
        throw getBlobAccessError("private");
      }
      throw error;
    }

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

  if (privateBlobToken) {
    try {
      await put(normalized, body, {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: jsonCacheSeconds,
        contentType: "application/json; charset=utf-8",
        token: privateBlobToken,
      });
    } catch (error) {
      if (isBlobAccessError(error, "private")) {
        throw getBlobAccessError("private");
      }
      throw error;
    }
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

  if (publicBlobToken) {
    let blob;
    try {
      blob = await put(normalized, file, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        cacheControlMaxAge: assetCacheSeconds,
        contentType: file.type || undefined,
        token: publicBlobToken,
      });
    } catch (error) {
      if (isBlobAccessError(error, "public")) {
        throw getBlobAccessError("public");
      }
      throw error;
    }
    return blob.url;
  }

  const destination = toLocalPublicPath(normalized);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const bytes = new Uint8Array(await file.arrayBuffer());
  await fs.writeFile(destination, bytes);
  return `/${normalized}`;
}
