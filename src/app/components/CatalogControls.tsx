"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type CatalogControlsProps = {
  selectedSort: string;
  minPrice: string;
  maxPrice: string;
  maxAvailablePrice: string;
  resultCount: number;
};

const SORT_OPTIONS = [
  { value: "featured", label: "Featured" },
  { value: "price-asc", label: "Price, low to high" },
  { value: "price-desc", label: "Price, high to low" },
  { value: "name-asc", label: "Alphabetically, A-Z" },
  { value: "name-desc", label: "Alphabetically, Z-A" },
] as const;

function formatPriceInput(value: number) {
  return value.toFixed(2).replace(/\.00$/, "").replace(/(\.\d)0$/, "$1");
}

function normalizePriceInput(raw: string) {
  const value = raw.trim();
  if (!value) return null;

  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;

  return formatPriceInput(Math.max(0, Math.round(numeric * 100) / 100));
}

function moneyLabel(value: string) {
  return `$${value}`;
}

export default function CatalogControls({
  selectedSort,
  minPrice,
  maxPrice,
  maxAvailablePrice,
  resultCount,
}: CatalogControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [openPanel, setOpenPanel] = useState<"sort" | "price" | null>(null);
  const [draftMinPrice, setDraftMinPrice] = useState(minPrice);
  const [draftMaxPrice, setDraftMaxPrice] = useState(maxPrice);

  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpenPanel(null);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenPanel(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function navigateWithParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") params.delete(key);
      else params.set(key, value);
    }

    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  function applySort(value: string) {
    navigateWithParams({ sort: value === "featured" ? null : value });
    setOpenPanel(null);
  }

  function applyPrice() {
    let nextMin = normalizePriceInput(draftMinPrice);
    let nextMax = normalizePriceInput(draftMaxPrice);

    if (nextMin && nextMax && Number(nextMin) > Number(nextMax)) {
      [nextMin, nextMax] = [nextMax, nextMin];
    }

    navigateWithParams({
      minPrice: nextMin,
      maxPrice: nextMax,
    });

    setOpenPanel(null);
  }

  function clearPrice() {
    setDraftMinPrice("");
    setDraftMaxPrice("");
    navigateWithParams({ minPrice: null, maxPrice: null });
    setOpenPanel(null);
  }

  function resetFilters() {
    setDraftMinPrice("");
    setDraftMaxPrice("");
    navigateWithParams({ minPrice: null, maxPrice: null, sort: null });
    setOpenPanel(null);
  }

  const activeSortLabel =
    SORT_OPTIONS.find((option) => option.value === selectedSort)?.label ?? SORT_OPTIONS[0].label;

  const priceSummary = useMemo(() => {
    if (!minPrice && !maxPrice) return "Any";
    if (minPrice && maxPrice) return `${moneyLabel(minPrice)} - ${moneyLabel(maxPrice)}`;
    if (minPrice) return `${moneyLabel(minPrice)}+`;
    return `Up to ${moneyLabel(maxPrice)}`;
  }, [minPrice, maxPrice]);

  const hasPriceFilter = Boolean(minPrice || maxPrice);
  const hasActiveFilters = hasPriceFilter || selectedSort !== "featured";

  return (
    <div className="catalogToolbar" ref={rootRef}>
      <div className="catalogControls">
        <div className={`catalogControl ${openPanel === "price" ? "catalogControlOpen" : ""}`}>
          <button
            type="button"
            className="catalogSummary"
            aria-haspopup="menu"
            aria-expanded={openPanel === "price"}
            onClick={() => setOpenPanel((current) => (current === "price" ? null : "price"))}
          >
            <span>Price</span>
            <span className="catalogSummaryValue">{priceSummary}</span>
            <span className="catalogCaret">^</span>
          </button>

          {openPanel === "price" && (
            <div className="catalogPanel" role="dialog" aria-label="Price filter">
              <div className="catalogPriceGrid">
                <div className="catalogPriceField">
                  <label className="catalogPriceLabel" htmlFor="catalog-min-price">
                    Min price
                  </label>
                  <div className="catalogPriceInputWrap">
                    <span className="catalogPriceCurrency">$</span>
                    <input
                      id="catalog-min-price"
                      className="catalogPriceInput"
                      inputMode="decimal"
                      placeholder="0"
                      value={draftMinPrice}
                      onChange={(event) => setDraftMinPrice(event.target.value)}
                    />
                  </div>
                </div>

                <div className="catalogPriceField">
                  <label className="catalogPriceLabel" htmlFor="catalog-max-price">
                    Max price
                  </label>
                  <div className="catalogPriceInputWrap">
                    <span className="catalogPriceCurrency">$</span>
                    <input
                      id="catalog-max-price"
                      className="catalogPriceInput"
                      inputMode="decimal"
                      placeholder={maxAvailablePrice || "0"}
                      value={draftMaxPrice}
                      onChange={(event) => setDraftMaxPrice(event.target.value)}
                    />
                  </div>
                </div>
              </div>

              <p className="catalogPanelMeta">
                Highest price in this view is {moneyLabel(maxAvailablePrice || "0")}.
              </p>

              <div className="catalogPanelActions">
                <button type="button" className="homeBtn" onClick={applyPrice}>
                  Apply
                </button>
                <button type="button" className="homeBtn ghost" onClick={clearPrice}>
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={`catalogControl ${openPanel === "sort" ? "catalogControlOpen" : ""}`}>
          <button
            type="button"
            className="catalogSummary"
            aria-haspopup="menu"
            aria-expanded={openPanel === "sort"}
            onClick={() => setOpenPanel((current) => (current === "sort" ? null : "sort"))}
          >
            <span>Sort</span>
            <span className="catalogSummaryValue">{activeSortLabel}</span>
            <span className="catalogCaret">^</span>
          </button>

          {openPanel === "sort" && (
            <div className="catalogPanel catalogPanelRight" role="menu" aria-label="Sort products">
              <div className="catalogOptionList">
                {SORT_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selectedSort === option.value}
                    className={`catalogOption ${selectedSort === option.value ? "catalogOptionActive" : ""}`}
                    onClick={() => applySort(option.value)}
                  >
                    <span>{option.label}</span>
                    <span className="catalogOptionCheck">{selectedSort === option.value ? "✓" : ""}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="catalogResults">
        <p className="catalogCount">
          {resultCount} Item{resultCount === 1 ? "" : "s"}
        </p>
        {hasActiveFilters && (
          <button type="button" className="catalogReset" onClick={resetFilters}>
            Reset filters
          </button>
        )}
      </div>
    </div>
  );
}
