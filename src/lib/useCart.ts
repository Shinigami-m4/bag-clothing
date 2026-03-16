"use client";

import { useEffect, useMemo, useState } from "react";
import { getCart, cartCount } from "./cart";
import type { CartItem } from "./cart";

const EVT = "bag:cart";

export function useCart() {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    // initial load after hydration
    setItems(getCart());

    const onUpdate = () => setItems(getCart());

    // your custom event
    window.addEventListener(EVT, onUpdate);

    // also update across tabs
    window.addEventListener("storage", onUpdate);

    return () => {
      window.removeEventListener(EVT, onUpdate);
      window.removeEventListener("storage", onUpdate);
    };
  }, []);

  const count = useMemo(() => items.reduce((s, i) => s + i.qty, 0), [items]);

  return { items, count };
}
