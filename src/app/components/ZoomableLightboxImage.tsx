"use client";

import { useEffect, useState } from "react";

type ZoomableLightboxImageProps = {
  src: string;
  alt: string;
  minHeight: string;
  maxHeight: string;
  children?: React.ReactNode;
};

const defaultZoomOrigin = "50% 50%";

export default function ZoomableLightboxImage({
  src,
  alt,
  minHeight,
  maxHeight,
  children,
}: ZoomableLightboxImageProps) {
  const [zoomed, setZoomed] = useState(false);
  const [zoomOrigin, setZoomOrigin] = useState(defaultZoomOrigin);

  useEffect(() => {
    setZoomed(false);
    setZoomOrigin(defaultZoomOrigin);
  }, [src]);

  function handleImageClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (zoomed) {
      setZoomed(false);
      setZoomOrigin(defaultZoomOrigin);
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    setZoomOrigin(`${Math.max(0, Math.min(100, x))}% ${Math.max(0, Math.min(100, y))}%`);
    setZoomed(true);
  }

  return (
    <div
      style={{
        position: "relative",
        borderRadius: 22,
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.12)",
        overflow: "hidden",
        minHeight,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(18px, 3vw, 28px)",
      }}
    >
      <button
        type="button"
        onClick={handleImageClick}
        aria-label={zoomed ? "Reset image zoom" : "Zoom image"}
        style={{
          width: "100%",
          border: "none",
          background: "transparent",
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: zoomed ? "zoom-out" : "zoom-in",
        }}
      >
        <img
          src={src}
          alt={alt}
          style={{
            width: "100%",
            maxHeight,
            objectFit: "contain",
            display: "block",
            transform: `scale(${zoomed ? 2.2 : 1})`,
            transformOrigin: zoomOrigin,
            transition: "transform 180ms ease-out",
            willChange: "transform",
          }}
        />
      </button>

      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          borderRadius: 999,
          background: "rgba(0,0,0,0.55)",
          padding: "8px 12px",
          fontSize: 11,
          letterSpacing: "0.08em",
          pointerEvents: "none",
        }}
      >
        {zoomed ? "CLICK IMAGE TO RESET" : "CLICK IMAGE TO ZOOM"}
      </div>

      {children}
    </div>
  );
}
