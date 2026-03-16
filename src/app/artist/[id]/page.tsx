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
import { getProductsByArtist } from "@/lib/inventory.server";

export default async function ArtistPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const artistId = id as ArtistId;

  const artist = artistConfig[artistId];
  if (!artist) {
    return <h1 className="title">Not found</h1>;
  }

  const qParam = firstSearchParam(sp.q) ?? "";
  const sortParam = firstSearchParam(sp.sort) ?? "featured";
  const minPriceParam = firstSearchParam(sp.minPrice);
  const maxPriceParam = firstSearchParam(sp.maxPrice);
  const q = qParam.trim().toLowerCase();

  const artistProducts = await getProductsByArtist(artistId);
  const scope = filterProductsByQuery(artistProducts, q);
  const selectedSort = normalizeSortValue(sortParam);

  const { list, minPriceCents, maxPriceCents, maxAvailablePriceCents } = filterAndSortProducts(
    scope,
    selectedSort,
    parsePriceParam(minPriceParam),
    parsePriceParam(maxPriceParam)
  );

  return (
    <>
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
    </>
  );
}
