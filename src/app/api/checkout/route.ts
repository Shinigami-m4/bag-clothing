import Stripe from "stripe";
import { NextResponse } from "next/server";
import { findLiveProductById } from "@/lib/inventory.server";
import { ONE_OF_ONE_SIZE } from "@/lib/product-options";
import { getProductSizeQuantity } from "@/lib/product-stock";

type CartItem = { productId: string; size?: string; qty: number };

function getStripeClient() {
  const apiKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured.");
  }

  return new Stripe(apiKey, {
    apiVersion: "2025-12-15.clover",
  });
}

export async function POST(req: Request) {
  const { items } = (await req.json()) as { items: CartItem[] };

  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ error: "Cart is empty" }, { status: 400 });
  }

  const line_items: Stripe.Checkout.SessionCreateParams.LineItem[] = [];
  const sanitizedItems: CartItem[] = [];
  const requestedBySize = new Map<string, number>();

  for (const it of items) {
    const p = await findLiveProductById(it.productId);
    if (!p) {
      return NextResponse.json({ error: "One or more products are no longer available." }, { status: 400 });
    }

    const requestedSize = typeof it.size === "string" ? it.size.trim() : "";
    const resolvedSize =
      requestedSize || (p.sizes.length === 1 ? p.sizes[0] : "");

    if (!resolvedSize || !p.sizes.includes(resolvedSize)) {
      return NextResponse.json(
        { error: `${p.name} requires a valid size selection before checkout.` },
        { status: 400 }
      );
    }

    const qty = Math.max(1, Math.min(99, it.qty));
    const requestKey = `${p.id}::${resolvedSize}`;
    const nextRequestedQty = (requestedBySize.get(requestKey) ?? 0) + qty;
    const availableQty = getProductSizeQuantity(p, resolvedSize);

    if (nextRequestedQty > availableQty) {
      return NextResponse.json(
        { error: `${p.name} only has ${availableQty} item${availableQty === 1 ? "" : "s"} left in ${resolvedSize}.` },
        { status: 400 }
      );
    }
    requestedBySize.set(requestKey, nextRequestedQty);

    line_items.push({
      quantity: qty,
      price_data: {
        currency: "usd",
        unit_amount: p.priceCents,
        product_data: {
          name: `${p.name} - ${resolvedSize || ONE_OF_ONE_SIZE}`,
        },
      },
    });

    sanitizedItems.push({ productId: p.id, size: resolvedSize, qty });
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    return NextResponse.json({ error: "NEXT_PUBLIC_SITE_URL is not configured." }, { status: 500 });
  }

  const stripe = getStripeClient();

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
