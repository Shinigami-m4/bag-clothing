import { NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_TTL_SECONDS,
  createAdminSessionToken,
} from "@/lib/adminAuth";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 5;

const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function getClientIp(req: Request) {
  const forwarded = req.headers.get("x-forwarded-for") || "";
  const ip = forwarded.split(",")[0]?.trim();
  return ip || req.headers.get("x-real-ip") || "unknown";
}

function secureEqual(a: string, b: string) {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return diff === 0;
}

function getLimiterState(ip: string) {
  const now = Date.now();
  const current = loginAttempts.get(ip);

  if (!current || current.resetAt <= now) {
    loginAttempts.delete(ip);
    return { count: 0, resetAt: now + LOGIN_WINDOW_MS };
  }

  return current;
}

function recordFailedAttempt(ip: string) {
  const state = getLimiterState(ip);
  loginAttempts.set(ip, {
    count: state.count + 1,
    resetAt: state.resetAt,
  });
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const limiter = getLimiterState(ip);

  if (limiter.count >= LOGIN_MAX_ATTEMPTS) {
    const retryAfter = Math.max(1, Math.ceil((limiter.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfter),
          "Cache-Control": "no-store",
        },
      }
    );
  }

  const { email, password } = await req.json();

  const adminEmail = (process.env.DEV_ADMIN_EMAIL || "").trim().toLowerCase();
  const adminPassword = (process.env.DEV_ADMIN_PASSWORD || "").trim();
  const secret = process.env.DEV_ADMIN_COOKIE_SECRET;

  if (!adminEmail || !adminPassword || !secret) {
    return NextResponse.json(
      { error: "Server missing admin env vars." },
      { status: 500 }
    );
  }

  // Strict credential check (server-side)
  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !secureEqual(email.trim().toLowerCase(), adminEmail) ||
    !secureEqual(password, adminPassword)
  ) {
    recordFailedAttempt(ip);
    return NextResponse.json(
      { error: "Invalid credentials." },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  loginAttempts.delete(ip);
  const token = await createAdminSessionToken(adminEmail, secret, ADMIN_SESSION_TTL_SECONDS);

  const res = NextResponse.json({ ok: true });

  res.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_TTL_SECONDS,
  });
  res.headers.set("Cache-Control", "no-store");

  return res;
}
