import Stripe from "stripe";
import { NextResponse } from "next/server";
import { decrementInventoryProductQuantities } from "@/lib/inventory.server";
import { hasProcessedStripeSession, markStripeSessionProcessed } from "@/lib/stripeEvents.server";

export const runtime = "nodejs";

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
  const sig = req.headers.get("stripe-signature");
  if (!sig) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const body = await req.text();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not configured." }, { status: 500 });
  }

  let event: Stripe.Event;

  try {
    event = getStripeClient().webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Invalid Stripe signature";
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  if (
    event.type === "checkout.session.completed" ||
    event.type === "checkout.session.async_payment_succeeded"
  ) {
    const session = event.data.object as Stripe.Checkout.Session;
    const sessionId = typeof session.id === "string" ? session.id.trim() : "";
    if (!sessionId) {
      return NextResponse.json({ error: "Missing checkout session id." }, { status: 400 });
    }

    if (await hasProcessedStripeSession(sessionId)) {
      return NextResponse.json({ received: true, duplicate: true });
    }

    const isPaidNow =
      event.type === "checkout.session.async_payment_succeeded" ||
      session.payment_status === "paid" ||
      session.payment_status === "no_payment_required";

    if (!isPaidNow) {
      return NextResponse.json({
        received: true,
        pending: true,
        payment_status: session.payment_status ?? "unknown",
      });
    }

    const rawCart = session.metadata?.cart;
    let cart: Array<{ productId: string; size?: string; qty: number }> = [];

    if (rawCart) {
      try {
        const parsed = JSON.parse(rawCart);
        if (Array.isArray(parsed)) {
          cart = parsed
            .map((entry) => ({
              productId: typeof entry?.productId === "string" ? entry.productId.trim() : "",
              size: typeof entry?.size === "string" ? entry.size.trim() : undefined,
              qty: Math.max(0, Math.floor(Number(entry?.qty) || 0)),
            }))
            .filter((entry) => entry.productId && entry.qty > 0);
        }
      } catch {
        cart = [];
      }
    }

    if (cart.length > 0) {
      await decrementInventoryProductQuantities(cart);
    }

    await markStripeSessionProcessed(sessionId);

    console.log("Payment confirmed:", {
      id: session.id,
      eventType: event.type,
      payment_status: session.payment_status,
      email: session.customer_details?.email,
      amount_total: session.amount_total,
      metadata: session.metadata,
    });
  }

  return NextResponse.json({ received: true });
}
