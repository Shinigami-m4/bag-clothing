"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import ZoomableLightboxImage from "@/app/components/ZoomableLightboxImage";

type PortfolioGalleryItem = {
  id: string;
  title: string;
  description?: string;
  coverImage: string;
  images: string[];
  createdAt: string;
};

type ActiveSlide = {
  entryIndex: number;
  imageIndex: number;
};

function getEntryImages(entry: PortfolioGalleryItem) {
  const images = entry.images.filter(Boolean);
  return images.length ? images : [entry.coverImage];
}

export default function PortfolioGallery({ items }: { items: PortfolioGalleryItem[] }) {
  const [active, setActive] = useState<ActiveSlide | null>(null);

  const activeEntry = active ? items[active.entryIndex] ?? null : null;
  const activeImageIndex = active?.imageIndex ?? 0;
  const activeImages = useMemo(() => {
    if (!activeEntry) return [] as string[];
    return getEntryImages(activeEntry);
  }, [activeEntry]);
  const activeImageSrc = activeEntry ? activeImages[activeImageIndex] ?? activeEntry.coverImage : null;

  function openEntry(entryIndex: number, imageIndex = 0) {
    setActive({ entryIndex, imageIndex });
  }

  function closeEntry() {
    setActive(null);
  }

  function handleCloseClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    closeEntry();
  }

  function goToImage(nextIndex: number) {
    setActive((current) => {
      if (!current) return current;

      const entry = items[current.entryIndex];
      if (!entry) return null;

      const images = getEntryImages(entry);
      const normalized = ((nextIndex % images.length) + images.length) % images.length;
      return { ...current, imageIndex: normalized };
    });
  }

  function shiftActiveImage(offset: number) {
    setActive((current) => {
      if (!current) return current;

      const entry = items[current.entryIndex];
      if (!entry) return null;

      const images = getEntryImages(entry);
      return {
        ...current,
        imageIndex: ((current.imageIndex + offset) % images.length + images.length) % images.length,
      };
    });
  }

  function showPrevious() {
    shiftActiveImage(-1);
  }

  function showNext() {
    shiftActiveImage(1);
  }

  useEffect(() => {
    if (!active) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeEntry();
      if (event.key === "ArrowLeft") shiftActiveImage(-1);
      if (event.key === "ArrowRight") shiftActiveImage(1);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [active, items]);

  let activeModal: ReturnType<typeof createPortal> | null = null;

  if (typeof window !== "undefined" && activeEntry && activeImageSrc) {
    activeModal = createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label={activeEntry.title}
        onClick={closeEntry}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          background: "rgba(0,0,0,0.88)",
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
              <h2
                style={{
                  margin: 0,
                  fontSize: "clamp(24px, 3vw, 40px)",
                  letterSpacing: "0.04em",
                  color: "#fff",
                }}
              >
                {activeEntry.title}
              </h2>
              {activeEntry.description ? (
                <p style={{ marginTop: 10, marginBottom: 0, color: "rgba(255,255,255,0.74)", lineHeight: 1.6 }}>
                  {activeEntry.description}
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
            src={activeImageSrc}
            alt={`${activeEntry.title} ${activeImageIndex + 1}`}
            minHeight="min(70vh, 720px)"
            maxHeight="min(64vh, 680px)"
          >
            {activeImages.length > 1 ? (
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
                  &lt;
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
                  &gt;
                </button>
              </>
            ) : null}

            {activeImages.length > 1 ? (
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
                  {activeImageIndex + 1} / {activeImages.length}
                </div>
              ) : null}
          </ZoomableLightboxImage>

          {activeImages.length > 1 ? (
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
              {activeImages.map((img, imageIndex) => {
                const selected = imageIndex === activeImageIndex;

                return (
                  <button
                    key={`${activeEntry.id}-${img}-${imageIndex}`}
                    type="button"
                    onClick={() => goToImage(imageIndex)}
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
                        alt={`${activeEntry.title} thumbnail ${imageIndex + 1}`}
                        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>,
      document.body
    );
  }

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 18,
        }}
      >
        {items.map((entry, entryIndex) => {
          const gallery = getEntryImages(entry);

          return (
            <article
              key={entry.id}
              style={{
                border: "1px solid rgba(255,255,255,0.2)",
                background: "rgba(0,0,0,0.5)",
                backdropFilter: "blur(8px)",
                borderRadius: 18,
                overflow: "hidden",
                boxShadow: "0 24px 48px rgba(0,0,0,0.26)",
              }}
            >
              <button
                type="button"
                onClick={() => openEntry(entryIndex, 0)}
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
                <div
                  style={{
                    aspectRatio: "4 / 3",
                    width: "100%",
                    background: "rgba(255,255,255,0.06)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 14,
                  }}
                >
                  <img
                    src={entry.coverImage}
                    alt={entry.title}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "contain",
                      display: "block",
                      borderRadius: 12,
                    }}
                  />
                </div>

                <div style={{ padding: 16 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                    }}
                  >
                    <h2 style={{ margin: 0, fontSize: 22, color: "#fff" }}>{entry.title}</h2>
                    <span style={{ fontSize: 12, letterSpacing: "0.08em", opacity: 0.76 }}>
                      VIEW ENTRY
                    </span>
                  </div>

                  {entry.description ? (
                    <p style={{ marginTop: 10, marginBottom: 0, color: "var(--muted)", lineHeight: 1.5 }}>
                      {entry.description}
                    </p>
                  ) : null}
                </div>
              </button>

              {gallery.length > 1 ? (
                <div
                  style={{
                    padding: "0 16px 16px",
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(88px, 1fr))",
                    gap: 10,
                  }}
                >
                  {gallery.map((img, imageIndex) => (
                    <button
                      key={`${entry.id}-${img}-${imageIndex}`}
                      type="button"
                      onClick={() => openEntry(entryIndex, imageIndex)}
                      style={{
                        border: "1px solid rgba(255,255,255,0.14)",
                        background: "rgba(255,255,255,0.04)",
                        borderRadius: 10,
                        padding: 6,
                        cursor: "pointer",
                      }}
                    >
                      <div
                        style={{
                          height: 72,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: "rgba(255,255,255,0.04)",
                          borderRadius: 8,
                          overflow: "hidden",
                        }}
                      >
                        <img
                          src={img}
                          alt={`${entry.title} ${imageIndex + 1}`}
                          style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
                        />
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      {activeModal}
    </>
  );
}
