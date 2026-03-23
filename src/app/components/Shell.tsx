"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { artistConfig, type ArtistId } from "@/lib/artists";
import { formatMoney, type Product } from "@/lib/products";
import { useCart } from "@/lib/useCart";
import { useEffect, useMemo, useRef, useState } from "react";

type ProductSummary = Pick<
  Product,
  "id" | "name" | "image" | "priceCents" | "artist" | "description" | "sizes"
>;

const SEARCH_RECENT_KEY = "bag_recently_viewed_v1";
const SEARCH_RECENT_MAX = 8;

function storageGet(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function storageSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

function storageRemove(key: string) {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

function openDialogElement(dialog: HTMLDialogElement) {
  try {
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
      return;
    }
  } catch {}

  dialog.setAttribute("open", "");
}

function closeDialogElement(dialog: HTMLDialogElement) {
  try {
    if (typeof dialog.close === "function") {
      dialog.close();
      return;
    }
  } catch {}

  dialog.removeAttribute("open");
}

export default function Shell({
  bg = "/bg/default.jpeg",
  children,
}: {
  bg?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const search = useSearchParams();

  const activeArtistParam = search?.get("artist") ?? null;
  const activeArtist =
    activeArtistParam && activeArtistParam in artistConfig
      ? (activeArtistParam as ArtistId)
      : null;

  const { count } = useCart();

  const [catalogOpen, setCatalogOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [adminAuthenticated, setAdminAuthenticated] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [allProducts, setAllProducts] = useState<ProductSummary[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [recentViewedIds, setRecentViewedIds] = useState<string[]>([]);

  const searchDialogRef = useRef<HTMLDialogElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const catalogRouteActive = pathname.startsWith("/catalog");
  const portfolioRouteActive = pathname.startsWith("/portfolio");
  const pathArtistRaw = pathname.match(/^\/artist\/([^/]+)/)?.[1];
  const pathArtist =
    pathArtistRaw && pathArtistRaw in artistConfig ? (pathArtistRaw as ArtistId) : null;
  const resolvedArtist = activeArtist ?? pathArtist;
  const hasAdminLogin = Boolean((process.env.NEXT_PUBLIC_DEV_ADMIN_EMAIL || "").trim());
  const bgUrl = resolvedArtist
    ? artistConfig[resolvedArtist].bg
    : portfolioRouteActive
      ? "/bg/default-1.jpeg"
      : bg;

  function setSearchFlagInUrl(open: boolean) {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    if (open) params.set("search", "1");
    else params.delete("search");

    const qs = params.toString();
    const next = `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`;
    window.history.replaceState(window.history.state, "", next);
  }

  async function loadProducts() {
    if (productsLoading || allProducts.length > 0) return;

    setProductsLoading(true);
    try {
      const res = await fetch("/api/products", { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      const next = Array.isArray(data.items) ? (data.items as ProductSummary[]) : [];
      setAllProducts(next);
    } catch {
      setAllProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }

  function readRecentIdsFromStorage() {
    if (typeof window === "undefined") return [] as string[];
    try {
      const raw = JSON.parse(storageGet(SEARCH_RECENT_KEY) || "[]");
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((x): x is string => typeof x === "string")
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, SEARCH_RECENT_MAX);
    } catch {
      return [];
    }
  }

  function writeRecentIdsToStorage(ids: string[]) {
    if (typeof window === "undefined") return;
    storageSet(SEARCH_RECENT_KEY, JSON.stringify(ids));
  }

  function pushRecentViewed(productId: string) {
    const normalized = productId.trim();
    if (!normalized) return;

    setRecentViewedIds((prev) => {
      const next = [normalized, ...prev.filter((id) => id !== normalized)].slice(0, SEARCH_RECENT_MAX);
      writeRecentIdsToStorage(next);
      return next;
    });
  }

  function clearRecentViewed() {
    setRecentViewedIds([]);
    if (typeof window !== "undefined") {
      storageRemove(SEARCH_RECENT_KEY);
    }
  }

  function openSearch() {
    setCatalogOpen(false);
    setAccountOpen(false);

    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      setSearchQuery(urlParams.get("q") ?? "");
      setRecentViewedIds(readRecentIdsFromStorage());
    } else {
      setSearchQuery(search?.get("q") ?? "");
    }

    setSearchOpen(true);
    setSearchFlagInUrl(true);
    void loadProducts();
  }

  function closeSearch() {
    setSearchOpen(false);
    setSearchFlagInUrl(false);
  }

  function openNewsletterGate() {
    setCatalogOpen(false);
    setAccountOpen(false);
    window.dispatchEvent(new CustomEvent("bag:open-newsletter-gate"));
  }

  function openAdminLogin() {
    setCatalogOpen(false);
    setAccountOpen(false);

    if (adminAuthenticated) {
      router.push("/admin");
      return;
    }

    window.dispatchEvent(
      new CustomEvent("bag:open-admin-login", {
        detail: { next: "/admin" },
      })
    );
  }

  async function logoutAdmin() {
    setCatalogOpen(false);
    setAccountOpen(false);

    try {
      await fetch("/api/dev-logout", {
        method: "POST",
        cache: "no-store",
      });
    } finally {
      setAdminAuthenticated(false);
      if (pathname.startsWith("/admin")) {
        window.location.href = "/";
      }
    }
  }

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();

    const q = searchQuery.trim();
    const params = new URLSearchParams();

    if (activeArtist) {
      params.set("artist", activeArtist);
    }
    if (q) {
      params.set("q", q);
    }

    const qs = params.toString();
    router.push(`/catalog${qs ? `?${qs}` : ""}`);
    setSearchOpen(false);
  }

  function jumpToProduct(product: ProductSummary) {
    pushRecentViewed(product.id);

    const params = new URLSearchParams();
    params.set("q", product.name);
    router.push(`/catalog?${params.toString()}`);
    setSearchOpen(false);
  }

  const filteredSearchProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allProducts.slice(0, 4);

    return allProducts
      .filter((p) => {
        const haystack = [p.name, p.id, p.artist, p.description ?? "", ...(p.sizes ?? [])]
          .join(" ")
          .toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 4);
  }, [allProducts, searchQuery]);

  const recentViewedProducts = useMemo(() => {
    if (!recentViewedIds.length || !allProducts.length) return [] as ProductSummary[];

    const byId = new Map(allProducts.map((p) => [p.id, p]));
    return recentViewedIds
      .map((id) => byId.get(id))
      .filter((p): p is ProductSummary => Boolean(p))
      .slice(0, 4);
  }, [allProducts, recentViewedIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setRecentViewedIds(readRecentIdsFromStorage());
  }, []);

  useEffect(() => {
    if (!hasAdminLogin) {
      setAdminAuthenticated(false);
      return;
    }

    let alive = true;

    async function loadAdminSession() {
      try {
        const res = await fetch("/api/dev-session", {
          cache: "no-store",
          credentials: "same-origin",
        });
        const data = await res.json().catch(() => ({}));
        if (alive) {
          setAdminAuthenticated(Boolean(data?.authenticated));
        }
      } catch {
        if (alive) {
          setAdminAuthenticated(false);
        }
      }
    }

    void loadAdminSession();

    return () => {
      alive = false;
    };
  }, [hasAdminLogin, pathname]);

  useEffect(() => {
    const runFromUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const shouldOpen = params.get("search") === "1";
      setSearchOpen(shouldOpen);
      if (shouldOpen) {
        setSearchQuery(params.get("q") ?? "");
        setRecentViewedIds(readRecentIdsFromStorage());
        void loadProducts();
      }
    };

    runFromUrl();

    const onPopState = () => runFromUrl();
    window.addEventListener("popstate", onPopState);

    return () => {
      window.removeEventListener("popstate", onPopState);
    };
  }, []);

  useEffect(() => {
    const dlg = searchDialogRef.current;
    if (!dlg) return;

    if (searchOpen && !dlg.open) {
      openDialogElement(dlg);
    }

    if (!searchOpen && dlg.open) {
      closeDialogElement(dlg);
    }
  }, [searchOpen]);

  useEffect(() => {
    if (!searchOpen) return;
    const t = window.setTimeout(() => searchInputRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, [searchOpen]);

  return (
    <>
      <div className="bgWrap" style={{ backgroundImage: `url(${bgUrl})` }}>
        <div className="bgOverlay" />
      </div>

      <div className="shell">
        <header
          className="topNav"
          onMouseLeave={() => {
            setCatalogOpen(false);
            setAccountOpen(false);
          }}
        >
          <Link href="/" aria-label="Home" title="Home" className="topNavLogo">
            <img src="/brand/logo.png" alt="B.A.G" className="topNavLogoImg" />
          </Link>

          <nav className="topNavCenter" aria-label="Primary">
            <Link className={`topLink ${pathname === "/" ? "topLinkActive" : ""}`} href="/">
              HOME
            </Link>

            <div
              className="topDropdown"
              onMouseEnter={() => {
                setAccountOpen(false);
                setCatalogOpen(true);
              }}
            >
              <button
                type="button"
                className={`topLink ${catalogRouteActive ? "topLinkActive" : ""}`}
                aria-haspopup="menu"
                aria-expanded={catalogOpen}
                onClick={() => {
                  setAccountOpen(false);
                  setCatalogOpen((v) => !v);
                }}
              >
                CATALOG
              </button>

              {catalogOpen && (
                <div className="topMenu" role="menu">
                  <Link className="topMenuItem" role="menuitem" href="/catalog">
                    Shop All
                  </Link>
                  <div className="topMenuDivider" />
                  {Object.entries(artistConfig).map(([id, a]) => (
                    <Link
                      key={id}
                      className={`topMenuItem ${activeArtist === id ? "topMenuItemActive" : ""}`}
                      role="menuitem"
                      href={`/catalog?artist=${id}`}
                    >
                      {a.name}
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <Link className={`topLink ${portfolioRouteActive ? "topLinkActive" : ""}`} href="/portfolio">
              PORTFOLIO
            </Link>

            <Link className={`topLink ${pathname === "/contact" ? "topLinkActive" : ""}`} href="/contact">
              CONTACT
            </Link>
          </nav>

          <div className="topNavRight">
            <button type="button" className="iconBtn" aria-label="Search" onClick={openSearch}>
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M21 21l-4.3-4.3"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
                <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>

            <div
              className="topDropdown"
              onMouseEnter={() => {
                setCatalogOpen(false);
                setAccountOpen(true);
              }}
            >
              <button
                type="button"
                className="iconBtn"
                aria-label="Account"
                aria-haspopup="menu"
                aria-expanded={accountOpen}
                onClick={() => {
                  setCatalogOpen(false);
                  setAccountOpen((v) => !v);
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M20 21a8 8 0 0 0-16 0"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
              </button>

              {accountOpen && (
                <div className="topMenu topMenuRight topAccountMenu" role="menu">
                  <p className="topMenuKicker">Drop List</p>
                  <p className="topMenuCopy">
                    Get notified on releases, restocks, and limited artist drops.
                  </p>
                  <button type="button" className="topMenuItem topMenuButton" role="menuitem" onClick={openNewsletterGate}>
                    Join The Newsletter
                  </button>
                  {hasAdminLogin && (
                    <>
                      <div className="topMenuDivider" />
                      <button
                        type="button"
                        className="topMenuItem topMenuButton"
                        role="menuitem"
                        onClick={openAdminLogin}
                      >
                        {adminAuthenticated ? "Admin Panel" : "Admin Sign In"}
                      </button>
                      {adminAuthenticated && (
                        <button
                          type="button"
                          className="topMenuItem topMenuButton"
                          role="menuitem"
                          onClick={logoutAdmin}
                        >
                          Sign Out
                        </button>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            <Link className="iconBtn cartBtn" aria-label="Cart" href="/cart">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M6 7h15l-1.5 9h-12z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
                <path d="M6 7l-2-3H2" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              {count > 0 && <span className="cartBadge">{count}</span>}
            </Link>
          </div>
        </header>

        <main className="main">{children}</main>
      </div>

      <dialog
        ref={searchDialogRef}
        onCancel={(e) => {
          e.preventDefault();
          closeSearch();
        }}
        onClick={(e) => {
          if (e.target === searchDialogRef.current) closeSearch();
        }}
        className="border-0 bg-white p-0 shadow-none backdrop:bg-black/70"
      >
        <div
          className="w-[min(86vw,640px)] overflow-hidden rounded-sm bg-white text-black shadow-2xl"
          style={{ backgroundColor: "#ffffff", opacity: 1 }}
        >
          <form
            onSubmit={submitSearch}
            className="flex items-center gap-2 border-b border-zinc-200 bg-white px-4 py-3"
            style={{ backgroundColor: "#ffffff", opacity: 1 }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true" className="opacity-70">
              <path
                d="M21 21l-4.3-4.3"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search"
              className="w-full border-0 bg-white text-base outline-none placeholder:text-black/55"

            />
            <button
              type="button"
              onClick={closeSearch}
              className="bg-transparent px-1 text-3xl leading-none text-black/70 hover:text-black"
              style={{ appearance: "none", border: "none", boxShadow: "none", outline: "none" }}
              aria-label="Close search"
            >
              x
            </button>
          </form>

          <div
            className="max-h-[70vh] overflow-y-auto bg-white px-4 pb-4 pt-3"
            style={{ backgroundColor: "#ffffff", opacity: 1 }}
          >
            <div className="mb-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-xs uppercase tracking-[0.08em] text-black/70">RECENTLY VIEWED</p>
                <button
                  type="button"
                  onClick={clearRecentViewed}
                  className="homeBtn"
                  style={{ height: 32, padding: "0 12px", fontSize: 11, letterSpacing: "0.12em" }}
                >
                  Clear
                </button>
              </div>

              {recentViewedProducts.length === 0 ? (
                <p className="text-sm text-black/50">No recently viewed items yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {recentViewedProducts.map((p) => (
                    <button
                      key={`recent-${p.id}`}
                      type="button"
                      onClick={() => jumpToProduct(p)}
                      className="bg-white text-left hover:opacity-90"
                    >
                      <img
                        src={p.image}
                        alt={p.name}
                        className="mb-1.5 h-40 w-full object-cover sm:h-44"
                      />
                      <p className="truncate text-[12px] uppercase">{p.name}</p>
                      <p className="text-[12px] text-black/70">${formatMoney(p.priceCents)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.08em] text-black/70">PRODUCTS</p>

              {productsLoading ? (
                <p className="py-4 text-sm text-black/60">Loading products...</p>
              ) : filteredSearchProducts.length === 0 ? (
                <p className="py-4 text-sm text-black/60">No results found.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {filteredSearchProducts.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => jumpToProduct(p)}
                      className="bg-white text-left hover:opacity-90"
                    >
                      <img
                        src={p.image}
                        alt={p.name}
                        className="mb-1.5 h-40 w-full object-cover sm:h-44"
                      />
                      <p className="truncate text-[12px] uppercase">{p.name}</p>
                      <p className="text-[12px] text-black/70">${formatMoney(p.priceCents)}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
