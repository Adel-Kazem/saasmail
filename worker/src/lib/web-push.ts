// Web Push (RFC 8291 content encoding + RFC 8292 VAPID).
// Pure WebCrypto — no dependencies.

export function b64urlEncode(input: Uint8Array | ArrayBuffer): string {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(input: string): Uint8Array {
  const pad = input.length % 4 === 0 ? 0 : 4 - (input.length % 4);
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad);
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

export interface VapidConfig {
  publicKey: string; // base64url raw (65 bytes: 0x04 || X || Y)
  privateKey: string; // base64url 32-byte scalar
  subject: string; // e.g. "mailto:admin@example.com"
}

export async function signVapidJwt(args: {
  audience: string;
  subject: string;
  publicKey: string;
  privateKey: string;
  expiresInSeconds?: number;
}): Promise<string> {
  const header = { alg: "ES256", typ: "JWT" };
  const exp =
    Math.floor(Date.now() / 1000) + (args.expiresInSeconds ?? 12 * 3600);
  const payload = { aud: args.audience, exp, sub: args.subject };

  const enc = (o: unknown) =>
    b64urlEncode(new TextEncoder().encode(JSON.stringify(o)));
  const signingInput = `${enc(header)}.${enc(payload)}`;

  // Import the private key via JWK so we can attach both d and the public x/y.
  const xy = b64urlDecode(args.publicKey); // 0x04 || X(32) || Y(32)
  if (xy.length !== 65 || xy[0] !== 0x04) {
    throw new Error("VAPID public key must be 65-byte uncompressed P-256");
  }
  const x = b64urlEncode(xy.slice(1, 33));
  const y = b64urlEncode(xy.slice(33, 65));
  const d = args.privateKey; // already base64url
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x,
    y,
    d,
    ext: true,
  };
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );
  return `${signingInput}.${b64urlEncode(sig)}`;
}

// ---- Placeholder exports for Task 4 (keeps imports valid) ----
export interface PushSubscriptionRecord {
  endpoint: string;
  p256dh: string;
  auth: string;
}
export interface PushPayload {
  title: string;
  body: string;
  tag: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
}
export { concatBytes };
