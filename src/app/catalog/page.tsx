import { Suspense } from "react";
import CatalogControls from "@/app/components/CatalogControls";
import ProductCard from "@/app/components/ProductCard";
import { artistConfig, type ArtistId } from "@/lib/artists";
import {
  collectCategoryOptions,
  collectSizeOptions,
  filterProductsByCategory,
  filterAndSortProducts,
  filterProductsByQuery,
  filterProductsBySize,
  firstSearchParam,
  formatPriceParam,
  normalizeSortValue,
  normalizeCategoryParam,
  normalizeSizeParam,
  parsePriceParam,
} from "@/lib/catalog";
import { getLiveProducts } from "@/lib/inventory.server";

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const artist = firstSearchParam(sp.artist);
  const qParam = firstSearchParam(sp.q) ?? "";
  const sortParam = firstSearchParam(sp.sort) ?? "featured";
  const categoryParam = firstSearchParam(sp.category);
  const sizeParam = firstSearchParam(sp.size);
  const minPriceParam = firstSearchParam(sp.minPrice);
  const maxPriceParam = firstSearchParam(sp.maxPrice);
  const q = qParam.trim().toLowerCase();

  const artistId = artist && artist in artistConfig ? (artist as ArtistId) : undefined;
  const selectedSort = normalizeSortValue(sortParam);
  const selectedCategory = normalizeCategoryParam(categoryParam);
  const selectedSize = normalizeSizeParam(sizeParam);
  const allProducts = await getLiveProducts();

  const filteredByArtist = artistId
    ? allProducts.filter((p) => p.artist === artistId)
    : allProducts;

  const scope = filterProductsByQuery(filteredByArtist, q);
  const categoryOptions = collectCategoryOptions(scope);
  const filteredByCategory = filterProductsByCategory(scope, selectedCategory);
  const sizeOptions = collectSizeOptions(filteredByCategory);
  const filteredBySize = filterProductsBySize(filteredByCategory, selectedSize);

  const { list, minPriceCents, maxPriceCents, maxAvailablePriceCents } = filterAndSortProducts(
    filteredBySize,
    selectedSort,
    parsePriceParam(minPriceParam),
    parsePriceParam(maxPriceParam)
  );

  return (
    <section className="catalogPage">
      <Suspense fallback={null}>
        <CatalogControls
          key={[
            selectedSort,
            selectedCategory ?? "",
            selectedSize ?? "",
            formatPriceParam(minPriceCents),
            formatPriceParam(maxPriceCents),
          ].join("|")}
          selectedSort={selectedSort}
          selectedCategory={selectedCategory ?? ""}
          selectedSize={selectedSize ?? ""}
          categoryOptions={categoryOptions}
          sizeOptions={sizeOptions}
          minPrice={formatPriceParam(minPriceCents)}
          maxPrice={formatPriceParam(maxPriceCents)}
          maxAvailablePrice={formatPriceParam(maxAvailablePriceCents)}
          resultCount={list.length}
        />
      </Suspense>

      {q ? (
        <p className="catalogSearchMeta">
          Search: <code>{qParam}</code> ({list.length} result{list.length === 1 ? "" : "s"})
        </p>
      ) : null}

      {list.length === 0 ? (
        <p style={{ opacity: 0.85 }}>No products found.</p>
      ) : (
        <div className="productGrid">
          {list.map((p) => (
            <ProductCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </section>
  );
}
