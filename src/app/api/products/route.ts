import { NextResponse } from "next/server";
import { getLiveProducts } from "@/lib/inventory.server";

export async function GET() {
  const items = await getLiveProducts();
  return NextResponse.json({ items });
}
