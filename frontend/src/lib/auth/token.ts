/**
 * Cookie names set by the Express API. Read-only here: the browser and the
 * API own these cookies, and this module only inspects them.
 */
export const ACCESS_COOKIE = "accessToken";
export const REFRESH_COOKIE = "refreshToken";
export const REFRESH_COOKIE_PATH = "/";
/** Path used before the refresh cookie was widened to "/". */
export const LEGACY_REFRESH_COOKIE_PATH = "/api/v1/auth";

/**
 * Decodes the JWT `exp` claim without verifying the signature. This is only
 * used to decide whether to rotate the session early. The API still verifies
 * every token on every request.
 */
export function isAccessTokenFresh(token: string, skewSeconds = 30): boolean {
  const payloadPart = token.split(".")[1];
  if (!payloadPart) return false;

  try {
    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded)) as { exp?: number };
    if (typeof payload.exp !== "number") return false;

    return payload.exp * 1000 > Date.now() + skewSeconds * 1000;
  } catch {
    return false;
  }
}
