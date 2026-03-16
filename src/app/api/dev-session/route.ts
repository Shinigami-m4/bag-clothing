import { cookies } from "next/headers";
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/adminAuth";

export async function GET() {
  const secret = process.env.DEV_ADMIN_COOKIE_SECRET || "";
  const adminEmail = process.env.DEV_ADMIN_EMAIL || "";
  const token = (await cookies()).get(ADMIN_COOKIE_NAME)?.value;

  const session =
    token && secret && adminEmail
      ? await verifyAdminSessionToken(token, secret, adminEmail)
      : null;

  return Response.json(
    {
      authenticated: Boolean(session),
      expiresAt: session?.exp ?? null,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
