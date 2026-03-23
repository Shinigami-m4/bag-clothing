"use client";

import { useMemo, useSyncExternalStore } from "react";
import { getCart } from "./cart";
import type { CartItem } from "./cart";

const EVT = "bag:cart";

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  window.addEventListener(EVT, onStoreChange);
  window.addEventListener("storage", onStoreChange);

  return () => {
    window.removeEventListener(EVT, onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getServerSnapshot(): CartItem[] {
  return [];
}

export function useCart() {
  const items = useSyncExternalStore(subscribe, getCart, getServerSnapshot);

  const count = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items]);

  return { items, count };
}
