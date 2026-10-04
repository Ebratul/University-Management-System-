import { NextResponse, type NextRequest } from "next/server";

import { serverEnv } from "@/lib/env.server";
import { clientIpFrom } from "@/lib/net/client-ip";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  LEGACY_REFRESH_COOKIE_PATH,
  REFRESH_COOKIE_PATH,
  isAccessTokenFresh,
} from "@/lib/auth/token";

/**
 * Runs before every matched request (Next 16 renamed middleware to proxy).
 *
 * - Protected areas need a fresh access token. If it is missing or expired,
 *   the refresh token is rotated here, before any page renders. The new
 *   cookies are applied to the same request, so Server Components see the
 *   new session and nothing redirects in a loop.
 * - Login and register bounce signed-in visitors to /dashboard.
 *
 * The role check is not here. The proxy cannot verify the JWT signature
 * without the API secret, so the role-gated layouts check the role instead.
 */
const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/faculty", "/student"];
const AUTH_PAGES = new Set(["/login", "/register"]);

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // API calls are rewritten to Express, which rate-limits per client IP. Without
  // this every visitor would look like the frontend server itself.
  if (pathname.startsWith("/api/v1")) return forwardWithClientIp(request);

  const access = request.cookies.get(ACCESS_COOKIE)?.value;
  const refresh = request.cookies.get(REFRESH_COOKIE)?.value;
  const hasFreshAccess = Boolean(access && isAccessTokenFresh(access));

  if (isProtected(pathname)) {
    if (hasFreshAccess) return NextResponse.next();
    if (!refresh) {
      // A stale access token with no refresh token that the proxy can see
      // (the browser never sends the legacy-path cookie to pages) is a dead
      // session. Clear it so the next visit starts clean.
      if (!access) return redirectToLogin(request);
      const response = redirectToLogin(request, "expired");
      clearSessionCookies(response);
      return response;
    }

    // Prefetches are background requests. Rotating the refresh token here
    // would race with the real navigation, and the API revokes a token that
    // is reused, which would sign the visitor out.
    if (isPrefetch(request)) return NextResponse.next();

    const rotated = await rotateSession(refresh, clientIpFrom(request.headers));
    if (!rotated) {
      const response = redirectToLogin(request, "expired");
      clearSessionCookies(response);
      return response;
    }

    return continueWithRotatedSession(request, rotated);
  }

  // After a rejected session the proxy sends the visitor to /login?reason=expired.
  // Skipping the bounce-to-dashboard for that request prevents a redirect loop
  // if the browser ever keeps the stale cookie.
  const sessionRejected = request.nextUrl.searchParams.has("reason");
  if (AUTH_PAGES.has(pathname) && !sessionRejected && (hasFreshAccess || refresh)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/v1/:path*", "/dashboard", "/admin/:path*", "/faculty/:path*", "/student/:path*", "/login", "/register"],
};

/** Adds the visitor's address as X-Forwarded-For; the rewrite carries headers through to Express. */
function forwardWithClientIp(request: NextRequest) {
  const headers = new Headers(request.headers);
  const ip = clientIpFrom(request.headers);
  if (ip) headers.set("x-forwarded-for", ip);
  return NextResponse.next({ request: { headers } });
}

function isProtected(pathname: string) {
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isPrefetch(request: NextRequest) {
  return request.headers.get("next-router-prefetch") === "1" || request.headers.get("purpose") === "prefetch";
}

function redirectToLogin(request: NextRequest, reason?: "expired") {
  const url = new URL("/login", request.url);
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
  url.searchParams.set("next", next);
  if (reason) url.searchParams.set("reason", reason);
  return NextResponse.redirect(url);
}

/** Exchanges the refresh token for a new session. Returns the Set-Cookie headers, or null if rejected. */
async function rotateSession(refreshToken: string, clientIp: string | null): Promise<string[] | null> {
  try {
    const upstream = await fetch(`${serverEnv.BACKEND_URL}/api/v1/auth/refresh-token`, {
      method: "POST",
      headers: {
        cookie: `${REFRESH_COOKIE}=${refreshToken}`,
        accept: "application/json",
        ...(clientIp ? { "x-forwarded-for": clientIp } : {}),
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });

    if (!upstream.ok) return null;

    const cookies = upstream.headers.getSetCookie();
    return cookies.length > 0 ? cookies : null;
  } catch {
    return null;
  }
}

function continueWithRotatedSession(request: NextRequest, setCookies: string[]) {
  // Server Components read cookies from the request headers, so the new
  // values have to be written there as well as onto the response.
  const updated = new Map<string, string>();
  for (const cookie of setCookies) {
    const [pair] = cookie.split(";");
    const separator = pair.indexOf("=");
    if (separator > 0) updated.set(pair.slice(0, separator), pair.slice(separator + 1));
  }

  const merged = new Map<string, string>();
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const trimmed = part.trim();
    const separator = trimmed.indexOf("=");
    if (separator > 0) merged.set(trimmed.slice(0, separator), trimmed.slice(separator + 1));
  }
  for (const [name, value] of updated) merged.set(name, value);

  const headers = new Headers(request.headers);
  headers.set("cookie", [...merged].map(([name, value]) => `${name}=${value}`).join("; "));

  const response = NextResponse.next({ request: { headers } });
  for (const cookie of setCookies) response.headers.append("set-cookie", cookie);
  return response;
}

/**
 * Expires the session cookies. Headers are appended one by one on purpose:
 * NextResponse.cookies keys by name, so the refresh cookie's two paths would
 * overwrite each other and one copy would survive.
 */
function clearSessionCookies(response: NextResponse) {
  const expire = (name: string, path: string) =>
    response.headers.append("set-cookie", `${name}=; Path=${path}; Max-Age=0; HttpOnly; SameSite=Lax`);

  expire(ACCESS_COOKIE, "/");
  expire(REFRESH_COOKIE, REFRESH_COOKIE_PATH);
  // Sessions created before the refresh cookie moved to "/" still carry the old path.
  expire(REFRESH_COOKIE, LEGACY_REFRESH_COOKIE_PATH);
}
