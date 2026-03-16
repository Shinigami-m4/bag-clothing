"use client";

import { createPortal } from "react-dom";

/**
 * Portal
 * ------------------------------------------------------------
 * Simple portal into document.body (no mount gating).
 * This avoids cases where a "mounted" flag prevents the modal
 * from rendering while scroll-lock still runs.
 */
export default function Portal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}