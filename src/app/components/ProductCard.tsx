"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { addToCart, getCartItemQty, reconcileCartQuantities } from "@/lib/cart";
import { formatMoney, type Product } from "@/lib/products";
import { useCart } from "@/lib/useCart";
import ZoomableLightboxImage from "@/app/components/ZoomableLightboxImage";

export default function ProductCard({ p }: { p: Product }) {
  const [added, setAdded] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [imageIndex, setImageIndex] = useState(0);
  const { items } = useCart();

  const gallery = useMemo(() => {
    const images = Array.isArray(p.images) ? p.images.filter(Boolean) : [];
    return images.length ? images : [p.image];
  }, [p.image, p.images]);

  const totalStock = typeof p.quantity === "number" ? Math.max(0, p.quantity) : undefined;
  const inCartQty = useMemo(
    () => items.find((item) => item.productId === p.id)?.qty ?? getCartItemQty(p.id),
    [items, p.id]
  );
  const remainingQty = typeof totalStock === "number" ? Math.max(0, totalStock - inCartQty) : undefined;
  const soldOut = typeof totalStock === "number" && totalStock <= 0;
  const maxInCart = typeof remainingQty === "number" && remainingQty <= 0;
  const hasImageStrip = gallery.length > 1;

  function flashAdded() {
    setAdded(true);
    window.setTimeout(() => setAdded(false), 900);
  }

  function handleAddToCart() {
    if (soldOut || maxInCart) return;
    addToCart(p, 1);
    flashAdded();
  }

  function openViewer(startIndex = 0) {
    setImageIndex(startIndex);
    setViewerOpen(true);
  }

  function closeViewer() {
    setViewerOpen(false);
  }

  function handleCloseClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    closeViewer();
  }

  function goToImage(nextIndex: number) {
    if (!gallery.length) return;
    const normalized = ((nextIndex % gallery.length) + gallery.length) % gallery.length;
    setImageIndex(normalized);
  }

  function showPrevious() {
    goToImage(imageIndex - 1);
  }

  function showNext() {
    goToImage(imageIndex + 1);
  }

  useEffect(() => {
    if (typeof p.quantity === "number") {
      reconcileCartQuantities([{ id: p.id, quantity: p.quantity }]);
    }
  }, [p.id, p.quantity]);

  useEffect(() => {
    if (!viewerOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeViewer();
      if (event.key === "ArrowLeft") {
        setImageIndex((current) => ((current - 1) % gallery.length + gallery.length) % gallery.length);
      }
      if (event.key === "ArrowRight") {
        setImageIndex((current) => (current + 1) % gallery.length);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [gallery.length, viewerOpen]);

  return (
    <>
      <div
        style={{
          border: "1px solid rgba(255,255,255,0.18)",
          borderRadius: 18,
          overflow: "hidden",
          background: "rgba(0,0,0,0.35)",
          backdropFilter: "blur(8px)",
        }}
      >
        <button
          type="button"
          onClick={() => openViewer(0)}
          style={{
            width: "100%",
            border: "none",
            background: "transparent",
            color: "inherit",
            padding: 0,
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <img src={p.image} alt={p.name} style={{ width: "100%", height: 260, objectFit: "cover", display: "block" }} />

          <div style={{ padding: 14, display: "grid", gap: 10 }}>
            <div className="brandFont" style={{ fontSize: 18, lineHeight: 1 }}>
              {p.name}
            </div>

            <div style={{ opacity: 0.85 }}>${formatMoney(p.priceCents)}</div>

            {p.description ? (
              <p style={{ minHeight: 44, margin: 0, opacity: 0.8, fontSize: 14, lineHeight: 1.5 }}>
                {p.description}
              </p>
            ) : null}

            {typeof totalStock === "number" ? (
              <div style={{ display: "grid", gap: 4 }}>
                <p style={{ margin: 0, opacity: 0.82, fontSize: 13 }}>
                  Available now: {remainingQty}
                </p>
                <p style={{ margin: 0, opacity: 0.68, fontSize: 12 }}>
                  In your cart: {inCartQty} / {totalStock}
                </p>
              </div>
            ) : null}

            {gallery.length > 1 ? (
              <p style={{ margin: 0, fontSize: 12, opacity: 0.68, letterSpacing: "0.08em" }}>
                VIEW {gallery.length} IMAGES
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: 12, opacity: 0.68, letterSpacing: "0.08em" }}>
                VIEW DETAILS
              </p>
            )}
          </div>
        </button>

        <div style={{ padding: "0 14px 14px", display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            onClick={handleAddToCart}
            disabled={soldOut || maxInCart}
            style={{
              marginLeft: "auto",
              padding: "10px 14px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.3)",
              background: "transparent",
              color: "inherit",
              cursor: soldOut || maxInCart ? "not-allowed" : "pointer",
              opacity: soldOut || maxInCart ? 0.5 : 1,
            }}
          >
            {soldOut ? "Sold out" : added ? "Added" : maxInCart ? "Max in cart" : "Add to cart"}
          </button>
        </div>
      </div>

      {typeof window !== "undefined" && viewerOpen
        ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={p.name}
          onClick={closeViewer}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.9)",
            padding: "clamp(16px, 4vw, 36px)",
            overflowY: "auto",
            overscrollBehavior: "contain",
            WebkitOverflowScrolling: "touch",
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(1120px, 100%)",
              margin: "0 auto",
              display: "grid",
              gap: 18,
              pointerEvents: "auto",
              paddingBottom: 8,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                gap: 16,
              }}
            >
              <div>
                <h2 style={{ margin: 0, fontSize: "clamp(24px, 3vw, 40px)", letterSpacing: "0.04em" }}>
                  {p.name}
                </h2>
                <p style={{ marginTop: 8, marginBottom: 0, color: "rgba(255,255,255,0.78)" }}>
                  ${formatMoney(p.priceCents)}
                  {typeof totalStock === "number" ? ` • Available now: ${remainingQty}` : ""}
                </p>
                {typeof totalStock === "number" ? (
                  <p style={{ marginTop: 8, marginBottom: 0, color: "rgba(255,255,255,0.62)", fontSize: 13 }}>
                    In your cart: {inCartQty} / {totalStock}
                  </p>
                ) : null}
                {p.description ? (
                  <p style={{ marginTop: 12, marginBottom: 0, color: "rgba(255,255,255,0.72)", lineHeight: 1.6 }}>
                    {p.description}
                  </p>
                ) : null}
              </div>

              <button
                type="button"
                onClick={handleCloseClick}
                style={{
                  position: "relative",
                  zIndex: 1001,
                  border: "1px solid rgba(255,255,255,0.24)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                  borderRadius: 999,
                  padding: "10px 14px",
                  cursor: "pointer",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  pointerEvents: "auto",
                }}
              >
                CLOSE
              </button>
            </div>

            <ZoomableLightboxImage
              src={gallery[imageIndex]}
              alt={`${p.name} ${imageIndex + 1}`}
              minHeight={hasImageStrip ? "min(48vh, 560px)" : "min(70vh, 720px)"}
              maxHeight={hasImageStrip ? "min(42vh, 500px)" : "min(64vh, 680px)"}
            >
              {hasImageStrip ? (
                <>
                  <button
                    type="button"
                    aria-label="Previous image"
                    onClick={showPrevious}
                    style={{
                      position: "absolute",
                      left: 16,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 48,
                      height: 48,
                      borderRadius: 999,
                      border: "1px solid rgba(255,255,255,0.24)",
                      background: "rgba(0,0,0,0.5)",
                      color: "#fff",
                      fontSize: 24,
                      cursor: "pointer",
                    }}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="Next image"
                    onClick={showNext}
                    style={{
                      position: "absolute",
                      right: 16,
                      top: "50%",
                      transform: "translateY(-50%)",
                      width: 48,
                      height: 48,
                      borderRadius: 999,
                      border: "1px solid rgba(255,255,255,0.24)",
                      background: "rgba(0,0,0,0.5)",
                      color: "#fff",
                      fontSize: 24,
                      cursor: "pointer",
                    }}
                  >
                    ›
                  </button>
                </>
              ) : null}

              {hasImageStrip ? (
                <div
                  style={{
                    position: "absolute",
                    bottom: 16,
                    left: "50%",
                    transform: "translateX(-50%)",
                    borderRadius: 999,
                    background: "rgba(0,0,0,0.55)",
                    padding: "8px 14px",
                    fontSize: 12,
                    letterSpacing: "0.08em",
                  }}
                >
                  {imageIndex + 1} / {gallery.length}
                </div>
              ) : null}
            </ZoomableLightboxImage>

            {hasImageStrip ? (
              <div
                style={{
                  display: "grid",
                  gridAutoFlow: "column",
                  gridAutoColumns: "minmax(92px, 140px)",
                  gap: 10,
                  overflowX: "auto",
                  paddingBottom: 4,
                }}
              >
                {gallery.map((img, idx) => {
                  const selected = idx === imageIndex;

                  return (
                    <button
                      key={`${p.id}-${img}-${idx}`}
                      type="button"
                      onClick={() => goToImage(idx)}
                      style={{
                        border: selected ? "2px solid #fff" : "1px solid rgba(255,255,255,0.16)",
                        background: selected ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.04)",
                        borderRadius: 12,
                        padding: 8,
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          height: 84,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          overflow: "hidden",
                          borderRadius: 8,
                        }}
                      >
                        <img
                          src={img}
                          alt={`${p.name} thumbnail ${idx + 1}`}
                          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={handleAddToCart}
                disabled={soldOut || maxInCart}
                style={{
                  padding: "12px 18px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.3)",
                  background: "rgba(255,255,255,0.08)",
                  color: "#fff",
                  cursor: soldOut || maxInCart ? "not-allowed" : "pointer",
                  opacity: soldOut || maxInCart ? 0.5 : 1,
                  letterSpacing: "0.06em",
                }}
              >
                {soldOut ? "Sold out" : added ? "Added" : maxInCart ? "Max in cart" : "Add to cart"}
              </button>
            </div>
          </div>
        </div>
        ,
        document.body
      )
        : null}
    </>
  );
}
