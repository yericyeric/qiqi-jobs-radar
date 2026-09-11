import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
export function sameSecret(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}
export function session(secret: string, now = Date.now()) {
  const p = Buffer.from(
    JSON.stringify({
      exp: now + 12 * 3600000,
      nonce: randomBytes(16).toString("hex"),
    }),
  ).toString("base64url");
  return `${p}.${sign(p, secret)}`;
}
export function validSession(
  token: string | undefined,
  secret: string,
  now = Date.now(),
) {
  if (!token || !secret) return false;
  const [p, s, ...rest] = token.split(".");
  if (!p || !s || rest.length || !sameSecret(s, sign(p, secret))) return false;
  try {
    const data = JSON.parse(Buffer.from(p, "base64url").toString());
    return (
      typeof data.exp === "number" &&
      data.exp > now &&
      data.exp <= now + 12 * 3600000
    );
  } catch {
    return false;
  }
}
const attempts = new Map<string, { count: number; until: number }>();
export function allowLogin(ip: string, now = Date.now()) {
  for (const [key, v] of attempts) if (v.until < now) attempts.delete(key);
  const entry = attempts.get(ip) || { count: 0, until: now + 15 * 60000 };
  entry.count++;
  attempts.set(ip, entry);
  return entry.count <= 10;
}
