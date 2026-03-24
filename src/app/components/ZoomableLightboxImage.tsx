"use client";

import { useEffect, useRef, useState } from "react";

type ZoomableLightboxImageProps = {
  src: string;
  alt: string;
  minHeight: string;
  maxHeight: string;
  children?: React.ReactNode;
};

const minZoomLevel = 1;
const maxZoomLevel = 5;
const defaultOffset = { x: 0, y: 0 };

export default function ZoomableLightboxImage({
  src,
  alt,
  minHeight,
  maxHeight,
  children,
}: ZoomableLightboxImageProps) {
  const [zoomLevel, setZoomLevel] = useState(minZoomLevel);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState(defaultOffset);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    moved: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);
  const zoomed = zoomLevel > minZoomLevel;

  useEffect(() => {
    setZoomLevel(minZoomLevel);
    setDragging(false);
    setOffset(defaultOffset);
  }, [src]);

  function clampOffset(x: number, y: number, rect: DOMRect, scale = zoomLevel) {
    const maxX = Math.max(0, (rect.width * (scale - 1)) / 2);
    const maxY = Math.max(0, (rect.height * (scale - 1)) / 2);

    return {
      x: Math.max(-maxX, Math.min(maxX, x)),
      y: Math.max(-maxY, Math.min(maxY, y)),
    };
  }

  function resetZoom() {
    setZoomLevel(minZoomLevel);
    setDragging(false);
    setOffset(defaultOffset);
  }

  function handleImageClick(event: React.MouseEvent<HTMLButtonElement>) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    if (zoomLevel >= maxZoomLevel) {
      resetZoom();
      return;
    }

    const nextZoomLevel = zoomLevel + 1;
    const rect = event.currentTarget.getBoundingClientRect();
    setZoomLevel(nextZoomLevel);
    setOffset((current) => clampOffset(current.x, current.y, rect, nextZoomLevel));
  }

  function handlePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
    if (!zoomed) return;

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: offset.x,
      originY: offset.y,
      moved: false,
    };
    setDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragStateRef.current;
    if (!zoomed || !drag || drag.pointerId !== event.pointerId) return;

    const nextX = drag.originX + (event.clientX - drag.startX);
    const nextY = drag.originY + (event.clientY - drag.startY);
    if (Math.abs(nextX - drag.originX) > 3 || Math.abs(nextY - drag.originY) > 3) {
      drag.moved = true;
    }

    setOffset(clampOffset(nextX, nextY, event.currentTarget.getBoundingClientRect()));
  }

  function finishPointerInteraction(target: HTMLButtonElement, pointerId: number) {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== pointerId) return;

    if (drag.moved) {
      suppressClickRef.current = true;
    }

    setDragging(false);
    dragStateRef.current = null;
    target.releasePointerCapture?.(pointerId);
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
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(event) => finishPointerInteraction(event.currentTarget, event.pointerId)}
        onPointerCancel={(event) => finishPointerInteraction(event.currentTarget, event.pointerId)}
        aria-label={
          zoomLevel >= maxZoomLevel ? "Reset image zoom" : `Zoom image to ${zoomLevel + 1}x`
        }
        style={{
          width: "100%",
          border: "none",
          background: "transparent",
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: zoomed ? (dragging ? "grabbing" : "grab") : "zoom-in",
          touchAction: zoomed ? "none" : "auto",
          userSelect: "none",
          WebkitUserSelect: "none",
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
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoomLevel})`,
            transformOrigin: "50% 50%",
            transition: dragging ? "none" : "transform 180ms ease-out",
            willChange: "transform",
            pointerEvents: "none",
          }}
        />
      </button>

      {children}
    </div>
  );
}
