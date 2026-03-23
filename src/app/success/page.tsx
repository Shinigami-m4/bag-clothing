"use client";

import Link from "next/link";
import { useEffect } from "react";
import { clearCart } from "@/lib/cart";

export default function SuccessPage() {
  useEffect(() => {
    clearCart();
  }, []);

  return (
    <section className="mx-auto max-w-3xl rounded-lg bg-black/60 p-6 text-white backdrop-blur-sm">
      <h1 className="title">Payment successful</h1>
      <p>Thank you! Your order is confirmed.</p>
      <Link href="/">Back to shop</Link>
    </section>
  );
}
