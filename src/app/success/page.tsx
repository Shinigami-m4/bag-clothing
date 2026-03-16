"use client";

import { useEffect } from "react";
import { clearCart } from "@/lib/cart";
import Shell from "@/app/components/Shell";

export default function SuccessPage() {
  useEffect(() => {
    clearCart();
  }, []);

  return (
    <Shell bg="/bg/default.jpeg">
      <h1 className="title">Payment successful 🎉</h1>
      <p>Thank you! Your order is confirmed.</p>
      <a href="/">Back to shop</a>
    </Shell>
  );
}
