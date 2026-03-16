export const ADMIN_COOKIE_NAME = "bag_admin";
export const ADMIN_SESSION_TTL_SECONDS = 60 * 30;

type AdminSessionPayload = {
  role: "admin";
  email: string;
  iat: number;
  exp: number;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function toHex(bytes: ArrayBuffer | Uint8Array) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  return [...view].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string) {
  if (!hex || hex.length % 2 !== 0) return null;

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const value = Number.parseInt(hex.slice(i, i + 2), 16);
    if (!Number.isFinite(value)) return null;
    bytes[i / 2] = value;
  }

  return bytes;
}

async function hmacSha256Hex(secret: string, message: string) {
  const enc = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return toHex(sig);
}

function secureEqual(a: string, b: string) {
  if (a.length !== b.length) return false;

  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return diff === 0;
}

export async function createAdminSessionToken(
  email: string,
  secret: string,
  ttlSeconds = ADMIN_SESSION_TTL_SECONDS
) {
  const now = Math.floor(Date.now() / 1000);
  const payload: AdminSessionPayload = {
    role: "admin",
    email: normalizeEmail(email),
    iat: now,
    exp: now + ttlSeconds,
  };

  const payloadHex = toHex(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await hmacSha256Hex(secret, payloadHex);
  return `${payloadHex}.${sig}`;
}

export async function verifyAdminSessionToken(
  token: string,
  secret: string,
  expectedEmail?: string
) {
  const [payloadHex, sig] = token.split(".");
  if (!payloadHex || !sig) return null;

  const expectedSig = await hmacSha256Hex(secret, payloadHex);
  if (!secureEqual(sig, expectedSig)) return null;

  const payloadBytes = fromHex(payloadHex);
  if (!payloadBytes) return null;

  try {
    const parsed = JSON.parse(new TextDecoder().decode(payloadBytes)) as Partial<AdminSessionPayload>;
    const now = Math.floor(Date.now() / 1000);

    if (parsed.role !== "admin") return null;
    if (typeof parsed.email !== "string" || !parsed.email.trim()) return null;
    if (typeof parsed.iat !== "number" || typeof parsed.exp !== "number") return null;
    if (!Number.isFinite(parsed.iat) || !Number.isFinite(parsed.exp)) return null;
    if (parsed.exp <= now) return null;
    if (parsed.iat > now + 60) return null;

    if (expectedEmail && normalizeEmail(parsed.email) !== normalizeEmail(expectedEmail)) {
      return null;
    }

    return {
      role: "admin" as const,
      email: normalizeEmail(parsed.email),
      iat: parsed.iat,
      exp: parsed.exp,
    };
  } catch {
    return null;
  }
}
