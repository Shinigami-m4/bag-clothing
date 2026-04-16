"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { artistConfig, type ArtistId } from "@/lib/artists";
import { formatMoney, type SizeQuantities } from "@/lib/products";
import {
  getCategoryLabel,
  getCategorySizeOptions,
  getDefaultSizesForCategory,
  ONE_OF_ONE_SIZE,
  PRODUCT_CATEGORY_VALUES,
  sortProductSizes,
  type ProductCategory,
} from "@/lib/product-options";
import {
  buildSizeQuantities,
  formatSizeQuantitySummary,
  getProductQuantity,
} from "@/lib/product-stock";
import { buildPortfolioAssetPath, buildProductAssetPath } from "@/lib/uploadPaths";

type InventoryItem = {
  id: string;
  name: string;
  artist: ArtistId;
  category: ProductCategory;
  priceCents: number;
  image: string;
  sizes: string[];
  sizeQuantities: SizeQuantities;
  description?: string;
  quantity: number;
  images?: string[];
  isPublished: boolean;
};

type PortfolioItem = {
  id: string;
  title: string;
  description?: string;
  coverImage: string;
  images: string[];
  createdAt: string;
};

const ARTIST_OPTIONS = Object.keys(artistConfig) as ArtistId[];
const multipartUploadThresholdBytes = 5 * 1024 * 1024;

function parseOptionalUsdToCents(raw: string): number | null {
  const value = raw.trim();
  if (!value) return 0;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

function parseOptionalWhole(raw: string): number | null {
  const value = raw.trim();
  if (!value) return 0;
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.floor(num);
}

function normalizeAdminSizes(sizes: string[], category: ProductCategory) {
  if (sizes.includes(ONE_OF_ONE_SIZE)) return [ONE_OF_ONE_SIZE];
  return sortProductSizes(sizes, category);
}

function buildSizeQuantityTextMap(
  sizes: string[],
  value?: SizeQuantities | Record<string, string> | null,
  fallbackTotal = 0
) {
  const normalized = buildSizeQuantities(sizes, value, fallbackTotal);
  return Object.fromEntries(sizes.map((size) => [size, String(normalized[size] ?? 0)]));
}

function parseAdminSizeQuantities(sizes: string[], values: Record<string, string>) {
  const sizeQuantities: SizeQuantities = {};

  for (const size of sizes) {
    const quantity = parseOptionalWhole(values[size] ?? "");
    if (quantity === null) {
      throw new Error(`Quantity for size ${size} must be a whole number (0 or higher).`);
    }
    sizeQuantities[size] = quantity;
  }

  return sizeQuantities;
}

function readImageFiles(fileList: FileList | null) {
  const seen = new Set<string>();

  return Array.from(fileList || []).filter((file) => {
    if (file.type && !file.type.startsWith("image/")) return false;

    const relPath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
    const key = `${relPath}|${file.size}|${file.lastModified}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function uploadAdminImages(
  files: File[],
  makePathname: (file: File) => string,
) {
  const uploaded: string[] = [];

  for (const file of files) {
    const blob = await upload(makePathname(file), file, {
      access: "public",
      handleUploadUrl: "/api/admin/uploads",
      multipart: file.size >= multipartUploadThresholdBytes,
      contentType: file.type || undefined,
    });
    uploaded.push(blob.url);
  }

  return uploaded;
}

export default function AdminPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [artist, setArtist] = useState<ArtistId>(ARTIST_OPTIONS[0]);
  const [category, setCategory] = useState<ProductCategory>("other");
  const [sizes, setSizes] = useState<string[]>(() => getDefaultSizesForCategory("other"));
  const [sizeQuantityTexts, setSizeQuantityTexts] = useState<Record<string, string>>(() =>
    buildSizeQuantityTextMap(getDefaultSizesForCategory("other"))
  );
  const [priceUsd, setPriceUsd] = useState("");
  const [description, setDescription] = useState("");
  const [isPublished, setIsPublished] = useState(false);
  const [image, setImage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [inventoryActionId, setInventoryActionId] = useState<string | null>(null);

  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [portfolioEditId, setPortfolioEditId] = useState<string | null>(null);
  const [portfolioTitle, setPortfolioTitle] = useState("");
  const [portfolioDescription, setPortfolioDescription] = useState("");
  const [portfolioCoverImage, setPortfolioCoverImage] = useState("");
  const [portfolioFiles, setPortfolioFiles] = useState<File[]>([]);
  const [portfolioPending, setPortfolioPending] = useState(false);
  const [portfolioError, setPortfolioError] = useState("");
  const [portfolioPendingLabel, setPortfolioPendingLabel] = useState<string | null>(null);
  const [logoutPending, setLogoutPending] = useState(false);

  const folderRef = useRef<HTMLInputElement>(null);
  const phoneImageRef = useRef<HTMLInputElement>(null);
  const portfolioFolderRef = useRef<HTMLInputElement>(null);
  const portfolioPhoneImageRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void refreshInventory();
    void refreshPortfolio();
  }, []);

  useEffect(() => {
    for (const ref of [folderRef.current, portfolioFolderRef.current]) {
      if (!ref) continue;
      ref.setAttribute("webkitdirectory", "");
      ref.setAttribute("directory", "");
    }
  }, []);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.artist.localeCompare(b.artist) || a.name.localeCompare(b.name)),
    [items]
  );

  const sortedPortfolioItems = useMemo(
    () =>
      [...portfolioItems].sort(
        (a, b) =>
          (Number.isFinite(Date.parse(b.createdAt)) ? Date.parse(b.createdAt) : 0) -
          (Number.isFinite(Date.parse(a.createdAt)) ? Date.parse(a.createdAt) : 0)
      ),
    [portfolioItems]
  );
  const categorySizeOptions = useMemo(() => getCategorySizeOptions(category), [category]);
  const oneOfOneSelected = sizes.includes(ONE_OF_ONE_SIZE);
  const draftTotalQuantity = useMemo(
    () =>
      sizes.reduce((sum, size) => {
        const quantity = parseOptionalWhole(sizeQuantityTexts[size] ?? "");
        return sum + (quantity ?? 0);
      }, 0),
    [sizes, sizeQuantityTexts]
  );

  function redirectToAdminLogin() {
    window.location.href = "/?gate=1&intent=admin&next=/admin";
  }

  async function refreshInventory() {
    try {
      const res = await fetch("/api/admin/products", { cache: "no-store" });
      if (res.status === 401) {
        redirectToAdminLogin();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setItems([]);
    }
  }

  async function refreshPortfolio() {
    try {
      const res = await fetch("/api/admin/portfolio", { cache: "no-store" });
      if (res.status === 401) {
        redirectToAdminLogin();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setPortfolioItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      setPortfolioItems([]);
    }
  }

  function handleCategoryChange(nextCategory: ProductCategory) {
    const nextSizes = getDefaultSizesForCategory(nextCategory);
    setCategory(nextCategory);
    setSizes(nextSizes);
    setSizeQuantityTexts((current) => buildSizeQuantityTextMap(nextSizes, current));
  }

  function toggleSize(size: string) {
    const nextSizes = (() => {
      if (size === ONE_OF_ONE_SIZE) {
        return sizes.includes(ONE_OF_ONE_SIZE) ? getDefaultSizesForCategory(category) : [ONE_OF_ONE_SIZE];
      }

      const withoutOneOfOne = sizes.filter((entry) => entry !== ONE_OF_ONE_SIZE);
      const next = withoutOneOfOne.includes(size)
        ? withoutOneOfOne.filter((entry) => entry !== size)
        : [...withoutOneOfOne, size];

      return normalizeAdminSizes(next, category);
    })();

    setSizes(nextSizes);
    setSizeQuantityTexts((current) => buildSizeQuantityTextMap(nextSizes, current));
  }

  function resetInventoryForm() {
    setId("");
    setName("");
    setArtist(ARTIST_OPTIONS[0]);
    setCategory("other");
    const nextSizes = getDefaultSizesForCategory("other");
    setSizes(nextSizes);
    setSizeQuantityTexts(buildSizeQuantityTextMap(nextSizes));
    setPriceUsd("");
    setDescription("");
    setIsPublished(false);
    setImage("");
    setFiles([]);
    if (folderRef.current) folderRef.current.value = "";
    if (phoneImageRef.current) phoneImageRef.current.value = "";
  }

  function loadInventoryToForm(item: InventoryItem) {
    setId(item.id);
    setName(item.name);
    setArtist(item.artist);
    setCategory(item.category);
    const nextSizes = normalizeAdminSizes(item.sizes ?? [], item.category);
    setSizes(nextSizes);
    setSizeQuantityTexts(buildSizeQuantityTextMap(nextSizes, item.sizeQuantities, item.quantity));
    setPriceUsd(item.priceCents > 0 ? (item.priceCents / 100).toString() : "");
    setDescription(item.description || "");
    setIsPublished(Boolean(item.isPublished));
    setImage(item.image || "");
    setFiles([]);
    if (folderRef.current) folderRef.current.value = "";
    if (phoneImageRef.current) phoneImageRef.current.value = "";
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function addInventoryItem(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setPendingLabel(null);
    setError("");

    try {
      const priceCents = parseOptionalUsdToCents(priceUsd);
      if (priceCents === null) {
        throw new Error("Price must be a valid number (example: 70 or 70.00).");
      }

      const selectedSizes = normalizeAdminSizes(sizes, category);
      if (!selectedSizes.length) {
        throw new Error("Select at least one size for this category or choose 1 of 1.");
      }

      const sizeQuantities = parseAdminSizeQuantities(selectedSizes, sizeQuantityTexts);
      const quantity = getProductQuantity({
        sizeQuantities,
        quantity: 0,
      });

      const productId = id.trim();
      let uploaded: string[] = [];
      if (files.length > 0) {
        setPendingLabel(`Uploading ${files.length} image${files.length === 1 ? "" : "s"}...`);
        uploaded = await uploadAdminImages(files, (file) => {
          const relPath =
            (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
          return buildProductAssetPath(productId, relPath || file.name);
        });
      }

      setPendingLabel("Saving product...");

      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: productId,
          name: name.trim(),
          artist,
          category,
          priceCents,
          sizes: selectedSizes,
          sizeQuantities,
          description,
          quantity,
          isPublished,
          image: image.trim() || uploaded[0] || "",
          images: uploaded.length ? uploaded : undefined,
        }),
      });

      if (res.status === 401) {
        redirectToAdminLogin();
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save product");
      }

      resetInventoryForm();
      await refreshInventory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save product");
    } finally {
      setPending(false);
      setPendingLabel(null);
    }
  }

  async function removeInventoryItem(itemId: string) {
    if (!window.confirm("Remove this product from admin inventory?")) return;

    setInventoryActionId(itemId);

    try {
      const res = await fetch("/api/admin/products", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: itemId }),
      });

      if (res.status === 401) {
        redirectToAdminLogin();
        return;
      }

      if (res.ok) {
        await refreshInventory();
        if (id.trim() === itemId) {
          resetInventoryForm();
        }
      }
    } finally {
      setInventoryActionId(null);
    }
  }

  function resetPortfolioForm() {
    setPortfolioEditId(null);
    setPortfolioTitle("");
    setPortfolioDescription("");
    setPortfolioCoverImage("");
    setPortfolioFiles([]);
    if (portfolioFolderRef.current) portfolioFolderRef.current.value = "";
    if (portfolioPhoneImageRef.current) portfolioPhoneImageRef.current.value = "";
  }

  function loadPortfolioToForm(item: PortfolioItem) {
    setPortfolioEditId(item.id);
    setPortfolioTitle(item.title);
    setPortfolioDescription(item.description || "");
    setPortfolioCoverImage(item.coverImage || "");
    setPortfolioFiles([]);
    if (portfolioFolderRef.current) portfolioFolderRef.current.value = "";
    if (portfolioPhoneImageRef.current) portfolioPhoneImageRef.current.value = "";
    setPortfolioError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function addPortfolioItem(e: React.FormEvent) {
    e.preventDefault();
    setPortfolioPending(true);
    setPortfolioPendingLabel(null);
    setPortfolioError("");

    try {
      const entryId = portfolioEditId || `${portfolioTitle.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "portfolio"}-${Date.now()}`;
      let uploaded: string[] = [];
      if (portfolioFiles.length > 0) {
        setPortfolioPendingLabel(
          `Uploading ${portfolioFiles.length} image${portfolioFiles.length === 1 ? "" : "s"}...`,
        );
        uploaded = await uploadAdminImages(portfolioFiles, (file) => {
          const relPath =
            (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name;
          return buildPortfolioAssetPath(entryId, relPath || file.name);
        });
      }

      setPortfolioPendingLabel("Saving portfolio entry...");

      const res = await fetch("/api/admin/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: portfolioEditId || entryId,
          title: portfolioTitle.trim(),
          description: portfolioDescription,
          coverImage: portfolioCoverImage.trim() || uploaded[0] || "",
          images: uploaded.length ? uploaded : undefined,
        }),
      });

      if (res.status === 401) {
        redirectToAdminLogin();
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save portfolio entry");
      }

      resetPortfolioForm();
      await refreshPortfolio();
    } catch (err) {
      setPortfolioError(err instanceof Error ? err.message : "Failed to save portfolio entry");
    } finally {
      setPortfolioPending(false);
      setPortfolioPendingLabel(null);
    }
  }

  async function removePortfolioItem(itemId: string) {
    if (!window.confirm("Remove this portfolio entry?")) return;

    const res = await fetch("/api/admin/portfolio", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: itemId }),
    });

    if (res.status === 401) {
      redirectToAdminLogin();
      return;
    }

    if (res.ok) {
      await refreshPortfolio();
      if (portfolioEditId === itemId) {
        resetPortfolioForm();
      }
    }
  }

  async function logoutAdmin() {
    setLogoutPending(true);

    try {
      await fetch("/api/dev-logout", {
        method: "POST",
        cache: "no-store",
      });
    } finally {
      window.location.href = "/";
    }
  }

  async function toggleInventoryVisibility(item: InventoryItem) {
    if (item.quantity <= 0) return;

    setInventoryActionId(item.id);
    setError("");

    try {
      const res = await fetch("/api/admin/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...item,
          isPublished: !item.isPublished,
        }),
      });

      if (res.status === 401) {
        redirectToAdminLogin();
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to update product visibility");
      }

      await refreshInventory();
      if (id.trim() === item.id) {
        setIsPublished(!item.isPublished);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update product visibility");
    } finally {
      setInventoryActionId(null);
    }
  }

  const liveProductCount = useMemo(
    () => items.filter((item) => item.isPublished && item.quantity > 0).length,
    [items]
  );

  return (
    <div className="adminPage mx-auto max-w-6xl p-6 text-white">
      <div className="rounded-lg border border-white/20 bg-black/65 p-4 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold">Admin: Inventory + Portfolio</h1>
          <button
            type="button"
            onClick={logoutAdmin}
            disabled={logoutPending}
            className="rounded border border-white/50 bg-white px-4 py-2 text-sm uppercase tracking-[0.12em] text-black disabled:opacity-60"
            style={{ color: "#000", WebkitTextFillColor: "#000" }}
          >
            {logoutPending ? "Signing Out..." : "Sign Out"}
          </button>
        </div>
        <p className="mt-1 text-sm text-white/80">
          Assign every product a category first, then use the size list for that category. Choose
          <b> 1 of 1</b> when the piece is a unique one-off instead of a standard size run.
        </p>
        <p className="mt-1 text-sm text-white/80">
          Products only appear on the live site when <b>Live on Website</b> is turned on. Any live
          product with total stock <b>0</b> is hidden automatically.
        </p>
        <p className="mt-1 text-sm text-white/80">
          On phone, use <b>Select Product Images</b> to choose multiple photos from a folder or
          album. Desktop can still upload a whole folder.
        </p>
        <p className="mt-1 text-sm text-white/80">
          Admin sessions expire automatically and the admin APIs are protected behind the same signed session.
        </p>
      </div>

      <section className="mt-6 rounded-lg border border-white/20 bg-black/65 p-4 backdrop-blur">
        <h2 className="text-2xl font-semibold">Artist Inventory</h2>

        <form onSubmit={addInventoryItem} className="mt-4 grid gap-3 lg:grid-cols-2">
          <label className="grid gap-1">
            <span className="text-xs uppercase tracking-[0.12em] text-white/80">Product ID</span>
            <input
              className="rounded border border-white/30 bg-white px-3 py-2 text-black"
              placeholder="doom-shirt-2"
              value={id}
              onChange={(e) => setId(e.target.value)}
              required
            />
            <span className="text-xs text-white/65">Unique key used for updates and deletes.</span>
          </label>

          <label className="grid gap-1">
            <span className="text-xs uppercase tracking-[0.12em] text-white/80">Product Name</span>
            <input
              className="rounded border border-white/30 bg-white px-3 py-2 text-black"
              placeholder="Doom Crest Tee"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs uppercase tracking-[0.12em] text-white/80">Artist</span>
            <select
              className="rounded border border-white/30 bg-white px-3 py-2 text-black"
              value={artist}
              onChange={(e) => setArtist(e.target.value as ArtistId)}
            >
              {ARTIST_OPTIONS.map((a) => (
                <option key={a} value={a}>
                  {artistConfig[a].name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-xs uppercase tracking-[0.12em] text-white/80">Category</span>
            <select
              className="rounded border border-white/30 bg-white px-3 py-2 text-black"
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value as ProductCategory)}
            >
              {PRODUCT_CATEGORY_VALUES.map((value) => (
                <option key={value} value={value}>
                  {getCategoryLabel(value)}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-xs uppercase tracking-[0.12em] text-white/80">Price (USD)</span>
            <input
              className="rounded border border-white/30 bg-white px-3 py-2 text-black"
              placeholder="70"
              value={priceUsd}
              onChange={(e) => setPriceUsd(e.target.value)}
              inputMode="decimal"
            />
            <span className="text-xs text-white/65">Example: 70 means $70.00.</span>
          </label>

          <div className="grid gap-2 rounded border border-white/20 bg-white/5 px-3 py-3 lg:col-span-2">
            <div className="grid gap-1">
              <span className="text-xs uppercase tracking-[0.12em] text-white/80">Sizes</span>
              <span className="text-xs text-white/65">
                Sizes update from the selected category. Choose 1 of 1 for one-off pieces.
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {categorySizeOptions.map((size) => {
                const selected = sizes.includes(size);
                const disabled = oneOfOneSelected && size !== ONE_OF_ONE_SIZE;

                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => toggleSize(size)}
                    disabled={disabled}
                    className={`rounded-full border px-3 py-2 text-xs font-semibold uppercase tracking-[0.08em] transition ${
                      selected
                        ? "border-white bg-white text-black"
                        : "border-white/35 bg-transparent text-white"
                    } disabled:cursor-not-allowed disabled:opacity-45`}
                    style={selected ? { color: "#000", WebkitTextFillColor: "#000" } : undefined}
                  >
                    {size}
                  </button>
                );
              })}
            </div>

          <span className="text-xs text-white/65">
            Selected: {sizes.length ? sizes.join(", ") : "None"}
          </span>
          </div>

          <div className="grid gap-2 rounded border border-white/20 bg-white/5 px-3 py-3 lg:col-span-2">
            <div className="grid gap-1">
              <span className="text-xs uppercase tracking-[0.12em] text-white/80">Stock by Size</span>
              <span className="text-xs text-white/65">
                Set the inventory for each selected size. Total stock updates automatically from these values.
              </span>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {sizes.map((size) => (
                <label key={size} className="grid gap-1">
                  <span className="text-xs uppercase tracking-[0.12em] text-white/80">{size}</span>
                  <input
                    className="rounded border border-white/30 bg-white px-3 py-2 text-black"
                    placeholder="0"
                    value={sizeQuantityTexts[size] ?? "0"}
                    onChange={(e) =>
                      setSizeQuantityTexts((current) => ({
                        ...current,
                        [size]: e.target.value,
                      }))
                    }
                    inputMode="numeric"
                  />
                </label>
              ))}
            </div>

            <span className="text-xs text-white/65">Total units in stock: {draftTotalQuantity}</span>
          </div>

          <label className="grid gap-1 lg:col-span-2">
            <span className="text-xs uppercase tracking-[0.12em] text-white/80">Description / Fit Notes</span>
            <textarea
              className="rounded border border-white/30 bg-white px-3 py-2 text-black"
              rows={4}
              placeholder="Handmade one-of-one piece. Include fit, materials, or special details."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            
          </label>

          <label className="grid gap-1">
            <span className="text-xs uppercase tracking-[0.12em] text-white/80">Cover Image URL</span>
            <input
              className="rounded border border-white/30 bg-white px-3 py-2 text-black"
              placeholder="Optional if folder uploaded"
              value={image}
              onChange={(e) => setImage(e.target.value)}
            />
          </label>

          <label className="flex items-start gap-3 rounded border border-white/20 bg-white/5 px-3 py-3 lg:col-span-2">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-white/40"
            />
            <span className="grid gap-1">
              <span className="text-xs uppercase tracking-[0.12em] text-white/80">Live on Website</span>
              <span className="text-xs text-white/65">
                Draft products stay in admin only. Published products show on the public site while total stock is above 0.
              </span>
            </span>
          </label>

          <label className="grid gap-1">
            <span className="text-xs uppercase tracking-[0.12em] text-white/80">Upload Product Folder (Desktop)</span>
            <input
              ref={folderRef}
              className="rounded border border-white/30 bg-white px-3 py-2 text-black"
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setFiles(readImageFiles(e.target.files))}
            />
            <span className="text-xs text-white/65">Desktop browsers can attach a full folder at once.</span>
          </label>

          <label className="grid gap-1">
            <span className="text-xs uppercase tracking-[0.12em] text-white/80">Select Product Images (Phone / Desktop)</span>
            <input
              ref={phoneImageRef}
              className="rounded border border-white/30 bg-white px-3 py-2 text-black"
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setFiles(readImageFiles(e.target.files))}
            />
            <span className="text-xs text-white/65">Use this on your phone to pick multiple images from a folder or album.</span>
          </label>

          {files.length ? (
            <p className="text-xs text-white/70 lg:col-span-2">{files.length} product image(s) ready to upload.</p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row lg:col-span-2">
            <button
              disabled={pending || !id.trim() || !name.trim()}
              className="rounded bg-white px-4 py-3 font-medium text-black disabled:opacity-60"
              style={{ color: "#000", WebkitTextFillColor: "#000" }}
            >
              {pending
                ? pendingLabel || "Saving..."
                : isPublished
                  ? "Save Live Product"
                  : "Save Draft Product"}
            </button>
            <button
              type="button"
              onClick={resetInventoryForm}
              className="rounded border border-white/50 bg-white px-4 py-3 text-black"
              style={{ color: "#000", WebkitTextFillColor: "#000" }}
            >
              Clear
            </button>
          </div>
        </form>

        {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}

        <div className="mt-6">
          <div className="mb-2 text-sm uppercase tracking-[0.12em] text-white/80">
            Posted Products ({liveProductCount} live / {Math.max(0, sortedItems.length - liveProductCount)} hidden)
          </div>
          <div className="space-y-2">
            {sortedItems.length === 0 ? (
              <p className="text-sm text-white/70">No products posted yet.</p>
            ) : (
              sortedItems.map((x) => {
                const liveStatus = x.isPublished && x.quantity > 0;
                const visibilityLabel = liveStatus ? "Live" : x.quantity <= 0 ? "Sold Out / Hidden" : "Draft";

                return (
                  <div
                    key={x.id}
                    className="flex flex-col gap-3 rounded border border-black/15 bg-white p-3 text-black sm:flex-row sm:items-start"
                    style={{ background: "#fff", color: "#000" }}
                  >
                    <div
                      style={{
                        width: 96,
                        height: 96,
                        minWidth: 96,
                        overflow: "hidden",
                        borderRadius: 10,
                        background: "#f3f4f6",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <img
                        src={x.image}
                        alt={x.name}
                        style={{
                          width: "100%",
                          height: "100%",
                          maxWidth: 96,
                          maxHeight: 96,
                          objectFit: "cover",
                          display: "block",
                          flexShrink: 0,
                        }}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold uppercase">{x.name}</div>
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] ${
                            liveStatus ? "bg-emerald-100 text-emerald-700" : "bg-black/10 text-black/70"
                          }`}
                        >
                          {visibilityLabel}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-black/70">
                        ID: {x.id} | Artist: {x.artist} | Category: {getCategoryLabel(x.category)} | Price: $
                        {formatMoney(x.priceCents)} | Total Qty: {x.quantity}
                      </div>
                      <div className="mt-1 text-xs text-black/70">Sizes: {x.sizes?.join(", ") || "1 of 1"}</div>
                      <div className="mt-1 text-xs text-black/70">Stock by size: {formatSizeQuantitySummary(x)}</div>
                      <div className="mt-1 text-xs text-black/70">{x.description || "No description"}</div>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[172px]">
                      <button
                        type="button"
                        onClick={() => toggleInventoryVisibility(x)}
                        disabled={inventoryActionId === x.id || x.quantity <= 0}
                        className="rounded border border-black/20 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] disabled:cursor-not-allowed disabled:opacity-50"
                        style={{ background: "#fff", color: "#000", WebkitTextFillColor: "#000" }}
                      >
                        {inventoryActionId === x.id ? "Updating..." : liveStatus ? "Hide" : x.quantity <= 0 ? "Restock to Publish" : "Publish Live"}
                      </button>
                      <button
                        type="button"
                        onClick={() => loadInventoryToForm(x)}
                        className="rounded border border-black/25 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em]"
                        style={{ background: "#fff", color: "#000", WebkitTextFillColor: "#000" }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removeInventoryItem(x.id)}
                        disabled={inventoryActionId === x.id}
                        className="rounded bg-red-600 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-white disabled:opacity-60"
                        style={{ background: "#fecaca", color: "#000", WebkitTextFillColor: "#000", border: "1px solid rgba(127,29,29,0.25)" }}
                      >
                        {inventoryActionId === x.id ? "Removing..." : "Remove"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-lg border border-white/20 bg-black/65 p-4 backdrop-blur">
        <h2 className="text-2xl font-semibold">Portfolio</h2>

        <form onSubmit={addPortfolioItem} className="mt-4 grid gap-3 lg:grid-cols-2">
          <label className="grid gap-1 lg:col-span-2">
            <span className="text-xs uppercase tracking-[0.12em] text-white/80">Title</span>
            <input
              className="rounded border border-white/30 bg-white px-3 py-2 text-black"
              placeholder="Runway Event - Brooklyn"
              value={portfolioTitle}
              onChange={(e) => setPortfolioTitle(e.target.value)}
              required
            />
          </label>

          <label className="grid gap-1 lg:col-span-2">
            <span className="text-xs uppercase tracking-[0.12em] text-white/80">Description</span>
            <textarea
              className="rounded border border-white/30 bg-white px-3 py-2 text-black"
              rows={4}
              placeholder="What happened at this event / shoot"
              value={portfolioDescription}
              onChange={(e) => setPortfolioDescription(e.target.value)}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs uppercase tracking-[0.12em] text-white/80">Cover Image URL</span>
            <input
              className="rounded border border-white/30 bg-white px-3 py-2 text-black"
              placeholder="Optional if folder uploaded"
              value={portfolioCoverImage}
              onChange={(e) => setPortfolioCoverImage(e.target.value)}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs uppercase tracking-[0.12em] text-white/80">Upload Portfolio Folder</span>
            <input
              ref={portfolioFolderRef}
              className="rounded border border-white/30 bg-white px-3 py-2 text-black"
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setPortfolioFiles(readImageFiles(e.target.files))}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-xs uppercase tracking-[0.12em] text-white/80">Select Portfolio Images (Phone / Desktop)</span>
            <input
              ref={portfolioPhoneImageRef}
              className="rounded border border-white/30 bg-white px-3 py-2 text-black"
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => setPortfolioFiles(readImageFiles(e.target.files))}
            />
          </label>

          {portfolioFiles.length ? (
            <p className="text-xs text-white/70 lg:col-span-2">{portfolioFiles.length} portfolio image(s) ready to upload.</p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row lg:col-span-2">
            <button
              disabled={portfolioPending || !portfolioTitle.trim()}
              className="rounded bg-white px-4 py-3 font-medium text-black disabled:opacity-60"
              style={{ color: "#000", WebkitTextFillColor: "#000" }}
            >
              {portfolioPending
                ? portfolioPendingLabel || "Saving..."
                : portfolioEditId
                  ? "Update Portfolio Entry"
                  : "Add Portfolio Entry"}
            </button>
            <button
              type="button"
              onClick={resetPortfolioForm}
              className="rounded border border-white/50 bg-white px-4 py-3 text-black"
              style={{ color: "#000", WebkitTextFillColor: "#000" }}
            >
              Clear
            </button>
          </div>
        </form>

        {portfolioError ? <p className="mt-3 text-sm text-red-300">{portfolioError}</p> : null}

        <div className="mt-6">
          <div className="mb-2 text-sm uppercase tracking-[0.12em] text-white/80">Posted Portfolio Entries</div>
          <div className="space-y-2">
            {sortedPortfolioItems.length === 0 ? (
              <p className="text-sm text-white/70">No portfolio entries posted yet.</p>
            ) : (
              sortedPortfolioItems.map((x) => (
                <div
                  key={x.id}
                  className="flex flex-col gap-3 rounded border border-black/15 bg-white p-3 text-black sm:flex-row sm:items-start"
                  style={{ background: "#fff", color: "#000" }}
                >
                  <div
                    style={{
                      width: 96,
                      height: 96,
                      minWidth: 96,
                      overflow: "hidden",
                      borderRadius: 10,
                      background: "#f3f4f6",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <img
                      src={x.coverImage}
                      alt={x.title}
                      style={{
                        width: "100%",
                        height: "100%",
                        maxWidth: 96,
                        maxHeight: 96,
                        objectFit: "cover",
                        display: "block",
                        flexShrink: 0,
                      }}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold uppercase">{x.title}</div>
                    <div className="mt-1 text-xs text-black/70">{x.description || "No description"}</div>
                    <div className="mt-1 text-xs text-black/70">{x.images?.length || 0} image(s)</div>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[172px]">
                    <button
                      type="button"
                      onClick={() => loadPortfolioToForm(x)}
                      className="rounded border border-black/25 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em]"
                      style={{ background: "#fff", color: "#000", WebkitTextFillColor: "#000" }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => removePortfolioItem(x.id)}
                      className="rounded bg-red-600 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.08em] text-white"
                      style={{ background: "#fecaca", color: "#000", WebkitTextFillColor: "#000", border: "1px solid rgba(127,29,29,0.25)" }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
