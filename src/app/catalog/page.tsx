import CatalogControls from "@/app/components/CatalogControls";
import ProductCard from "@/app/components/ProductCard";
import { artistConfig, type ArtistId } from "@/lib/artists";
import {
  filterAndSortProducts,
  filterProductsByQuery,
  firstSearchParam,
  formatPriceParam,
  normalizeSortValue,
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
  const minPriceParam = firstSearchParam(sp.minPrice);
  const maxPriceParam = firstSearchParam(sp.maxPrice);
  const q = qParam.trim().toLowerCase();

  const artistId = artist && artist in artistConfig ? (artist as ArtistId) : undefined;
  const selectedSort = normalizeSortValue(sortParam);
  const allProducts = await getLiveProducts();

  const filteredByArtist = artistId
    ? allProducts.filter((p) => p.artist === artistId)
    : allProducts;

  const scope = filterProductsByQuery(filteredByArtist, q);

  const { list, minPriceCents, maxPriceCents, maxAvailablePriceCents } = filterAndSortProducts(
    scope,
    selectedSort,
    parsePriceParam(minPriceParam),
    parsePriceParam(maxPriceParam)
  );

  return (
    <section className="catalogPage">
      <CatalogControls
        key={[selectedSort, formatPriceParam(minPriceCents), formatPriceParam(maxPriceCents)].join("|")}
        selectedSort={selectedSort}
        minPrice={formatPriceParam(minPriceCents)}
        maxPrice={formatPriceParam(maxPriceCents)}
        maxAvailablePrice={formatPriceParam(maxAvailablePriceCents)}
        resultCount={list.length}
      />

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
