import { NextResponse } from "next/server";
import { readPortfolio } from "@/lib/portfolio.server";

export async function GET() {
  const items = await readPortfolio();
  return NextResponse.json({ items });
}