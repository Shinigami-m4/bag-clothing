import Stripe from "stripe";
import { NextResponse } from "next/server";
import { findLiveProductById } from "@/lib/inventory.server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-12-15.clover",
});

type CartItem = { productId: string; qty: number };

export async function POST(req: Request) {
  const { items } = (await req.json()) as { items: CartItem[] };

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const sanitizedItems: CartItem[] = [];

  for (const it of items) {
    const p = await findLiveProductById(it.productId);
    if (!p) {
      return NextResponse.json({ error: "One or more products are no longer available." }, { status: 400 });
    }

    const qty = Math.max(1, Math.min(99, it.qty));
    if (typeof p.quantity === "number" && qty > p.quantity) {
      return NextResponse.json(
        { error: `${p.name} only has ${p.quantity} item${p.quantity === 1 ? "" : "s"} left.` },
        { status: 400 }
      );
    }

    line_items.push({
      quantity: qty,
      price_data: {
        currency: "usd",
        unit_amount: p.priceCents,
        product_data: {
          name: p.name,
        },
      },
    });

    sanitizedItems.push({ productId: p.id, qty });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL!;

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items,
    success_url: `${siteUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${siteUrl}/cart`,
    shipping_address_collection: { allowed_countries: ["US"] },
    phone_number_collection: { enabled: true },
    metadata: {
      cart: JSON.stringify(sanitizedItems),
    },
  });

  return NextResponse.json({ url: session.url });
}
