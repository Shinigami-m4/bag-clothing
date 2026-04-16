"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatMoney, type Product } from "@/lib/products";
import { reconcileCartQuantities, removeFromCart, setCartItemQty } from "@/lib/cart";
import { ONE_OF_ONE_SIZE } from "@/lib/product-options";
import { useCart } from "@/lib/useCart";

type ProductLookup = Pick<Product, "id" | "name" | "image" | "priceCents" | "quantity" | "sizes">;

export default function CartPage() {
  const { items, count } = useCart();
  const [allProducts, setAllProducts] = useState<ProductLookup[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadProducts() {
      setLoadingProducts(true);
      try {
        const res = await fetch("/api/products", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        const next = Array.isArray(data.items) ? (data.items as ProductLookup[]) : [];
        if (alive) {
          setAllProducts(next);
          reconcileCartQuantities(next);
        }
      } catch {
        if (alive) setAllProducts([]);
      } finally {
        if (alive) setLoadingProducts(false);
      }
    }

    void loadProducts();

    return () => {
      alive = false;
    };
  }, []);

  const productById = useMemo(() => {
    return new Map(allProducts.map((p) => [p.id, p]));
  }, [allProducts]);

  const cartLines = useMemo(() => {
    return items.map((item) => {
      const product = productById.get(item.productId);
      const fallbackSize = product?.sizes.length === 1 ? product.sizes[0] : "";
      const lineSize = item.size || fallbackSize || ONE_OF_ONE_SIZE;
      const sizeValid = Boolean(product) && lineSize !== "" && Boolean(product?.sizes.includes(lineSize));
      return { item, product, lineSize, sizeValid };
    });
  }, [items, productById]);

  const cartQtyByProductId = useMemo(() => {
    return items.reduce((map, item) => {
      map.set(item.productId, (map.get(item.productId) ?? 0) + item.qty);
      return map;
    }, new Map<string, number>());
  }, [items]);

  const subtotalCents = useMemo(() => {
    return cartLines.reduce((sum, line) => {
      return sum + (line.product?.priceCents ?? 0) * line.item.qty;
    }, 0);
  }, [cartLines]);

  const checkoutReady = useMemo(() => {
    if (!items.length || loadingProducts) return false;
    return cartLines.every((line) => Boolean(line.product) && line.sizeValid);
  }, [cartLines, items.length, loadingProducts]);

  async function startCheckout() {
    if (!checkoutReady || checkoutPending) return;

    setCheckoutPending(true);
    setCheckoutError("");

    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartLines.map((line) => ({
            productId: line.item.productId,
            size: line.lineSize,
            qty: line.item.qty,
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error || "Unable to start checkout right now.");
      }

      if (!data?.url || typeof data.url !== "string") {
        throw new Error("Stripe checkout URL was not returned.");
      }

      window.location.href = data.url;
    } catch (error) {
      setCheckoutError(error instanceof Error ? error.message : "Unable to start checkout right now.");
      setCheckoutPending(false);
    }
  }

  return (
    <section className="cartPage mx-auto max-w-6xl">
      <div className="rounded-lg bg-black/60 p-5 backdrop-blur-sm">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-4xl font-bold">Cart ({count})</h1>
          <Link href="/catalog" className="text-sm text-white/75 hover:text-white">
            Continue Shopping
          </Link>
        </div>

        {!items.length ? (
          <p className="mt-5 text-white/80">Your cart is currently empty.</p>
        ) : (
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px]">
            <div className="space-y-2.5">
              {cartLines.map(({ item, product, lineSize, sizeValid }) => {
                const key = `${item.productId}:${item.size}`;
                const lineTotalCents = (product?.priceCents ?? 0) * item.qty;
                const maxQty = typeof product?.quantity === "number" ? Math.max(0, product.quantity) : undefined;
                const totalInCartForProduct = cartQtyByProductId.get(item.productId) ?? item.qty;
                const otherQty = Math.max(0, totalInCartForProduct - item.qty);
                const maxLineQty = typeof maxQty === "number" ? Math.max(0, maxQty - otherQty) : undefined;
                const atMax = typeof maxLineQty === "number" && item.qty >= maxLineQty;
                const remainingQty = typeof maxQty === "number" ? Math.max(0, maxQty - totalInCartForProduct) : undefined;

                return (
                  <div
                    key={key}
                    className="flex items-start rounded-md bg-black/55 p-3"
                  >
                    <img
                        src={product?.image || "/brand/logo.PNG"}
                      alt={product?.name || item.productId}
                      className="shrink-0 rounded object-cover"
                      style={{ width: 82, height: 110, marginRight: 22 }}
                    />

                    <div className="min-w-0 flex-1" style={{ paddingLeft: 14 }}>
                      <p className="truncate text-sm font-semibold uppercase text-white">
                        {product?.name || item.productId}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.12em] text-white/70">
                        Size: {sizeValid ? lineSize : "Size not selected"}
                      </p>
                      <p className="mt-1 text-sm text-white/90">
                        ${formatMoney(product?.priceCents ?? 0)} each
                      </p>
                      {typeof maxQty === "number" ? (
                        <p className="mt-1 text-xs text-white/65">
                          In your cart: {item.qty} / {maxQty}
                          {remainingQty === 0 ? " • max reached" : ` • ${remainingQty} left`}
                        </p>
                      ) : null}

                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setCartItemQty(item.productId, item.size, item.qty - 1, maxQty)}
                            className="homeBtn ghost text-sm tracking-[0.08em]" style={{ height: 32, minWidth: 36, padding: 0 }}
                            aria-label="Decrease quantity"
                          >
                            -
                          </button>
                          <span className="min-w-7 text-center text-sm font-semibold text-white">
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => setCartItemQty(item.productId, item.size, item.qty + 1, maxQty)}
                            disabled={atMax || !sizeValid}
                            className="homeBtn ghost text-sm tracking-[0.08em]" style={{ height: 32, minWidth: 36, padding: 0 }}
                            aria-label="Increase quantity"
                          >
                            +
                          </button>

                          <button
                            type="button"
                            onClick={() => removeFromCart(item.productId, item.size)}
                            className="homeBtn ghost ml-1 text-[11px] tracking-[0.1em]" style={{ height: 32, padding: "0 12px" }}
                          >
                            Remove
                          </button>
                        </div>

                        <p className="text-sm font-semibold text-white">
                          ${formatMoney(lineTotalCents)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <aside className="h-fit rounded-md bg-black/55 p-4">
              <p className="text-sm uppercase tracking-[0.12em] text-white/70">Order Summary</p>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-white/70">Items</p>
                <p className="text-white">{count}</p>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <p className="text-white/85">Subtotal</p>
                <p className="text-xl font-semibold text-white">${formatMoney(subtotalCents)}</p>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm">
                <p className="text-white/70">Shipping</p>
                <p className="text-white/70">Calculated at checkout</p>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <p className="text-white/70">Checkout</p>
                <p className="text-white/70">Stripe</p>
              </div>
              <button
                type="button"
                onClick={startCheckout}
                disabled={!checkoutReady || checkoutPending}
                className="homeBtn mt-4 w-full justify-center"
              >
                {checkoutPending ? "Redirecting..." : "Checkout"}
              </button>

              {loadingProducts ? (
                <p className="mt-2 text-xs text-white/65">Refreshing product details...</p>
              ) : null}
              {!loadingProducts && !checkoutReady ? (
                <p className="mt-2 text-xs text-red-200">
                  One or more cart items are unavailable or missing a valid size. Remove and re-add them before checkout.
                </p>
              ) : null}
              {checkoutError ? (
                <p className="mt-2 text-xs text-red-200">{checkoutError}</p>
              ) : null}
            </aside>
          </div>
        )}
      </div>
    </section>
  );
}
