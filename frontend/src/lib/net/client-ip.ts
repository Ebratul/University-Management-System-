/**
 * The visitor's IP as the platform saw it. Vercel and most reverse proxies set
 * `x-real-ip`, and append the client address as the last `x-forwarded-for`
 * entry. Earlier entries came from the client and cannot be trusted.
 */
export function clientIpFrom(headers: Headers): string | null {
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  const forwarded = headers.get("x-forwarded-for");
  if (!forwarded) return null;

  const parts = forwarded.split(",").map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) ?? null;
}
