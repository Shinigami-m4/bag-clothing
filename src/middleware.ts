// middleware.ts
import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/adminAuth";

export async function middleware(req: NextRequest) {
  const pathname = req.nextUrl.pathname;

  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");
  if (!isAdminPage && !isAdminApi) return NextResponse.next();

  const adminEmail = process.env.DEV_ADMIN_EMAIL || "";
  const secret = process.env.DEV_ADMIN_COOKIE_SECRET || "";
  const token = req.cookies.get(ADMIN_COOKIE_NAME)?.value;
  const session =
    token && secret && adminEmail
      ? await verifyAdminSessionToken(token, secret, adminEmail)
      : null;

  if (!session) {
    if (isAdminApi) {
      const res = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      res.cookies.set(ADMIN_COOKIE_NAME, "", {
        httpOnly: true,
        sameSite: "strict",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
      });
      res.headers.set("Cache-Control", "no-store");
      return res;
    }

    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.searchParams.set("gate", "1"); // open modal on landing
    url.searchParams.set("intent", "admin");
    url.searchParams.set("next", `${pathname}${req.nextUrl.search}`);

    const res = NextResponse.redirect(url);
    res.cookies.set(ADMIN_COOKIE_NAME, "", {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0,
    });
    res.headers.set("Cache-Control", "no-store");
    return res;
  }

  const res = NextResponse.next();
  res.headers.set("Cache-Control", "no-store");
  res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
