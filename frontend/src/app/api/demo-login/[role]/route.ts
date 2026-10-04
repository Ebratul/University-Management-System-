import { NextResponse, type NextRequest } from "next/server";

import { demoCredentials, serverEnv } from "@/lib/env.server";
import { DEMO_ROLE_SEGMENT, homeForRole } from "@/lib/auth/roles";
import { clientIpFrom } from "@/lib/net/client-ip";

/**
 * One-click demo login. Credentials come from server-only env vars and never
 * reach the browser. This handler signs in against the API and forwards the
 * Set-Cookie headers, so the visitor ends up with a normal session.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/demo-login/[role]">) {
  const { role: segment } = await ctx.params;
  const role = DEMO_ROLE_SEGMENT[segment];

  if (!role) {
    return NextResponse.json(
      { success: false, statusCode: 404, message: "Unknown demo role." },
      { status: 404 },
    );
  }

  const credentials = demoCredentials[role];
  const upstream = await fetch(`${serverEnv.BACKEND_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
      ...(clientIpFrom(request.headers) ? { "x-forwarded-for": clientIpFrom(request.headers)! } : {}),
    },
    body: JSON.stringify(credentials),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  if (!upstream.ok) {
    const body = (await upstream.json().catch(() => null)) as { message?: string } | null;
    return NextResponse.json(
      {
        success: false,
        statusCode: upstream.status,
        message: body?.message ?? "The demo account could not be signed in.",
      },
      { status: upstream.status },
    );
  }

  const response = NextResponse.json({
    success: true,
    statusCode: 200,
    message: "Demo session started.",
    data: { role, redirectTo: homeForRole(role) },
  });

  for (const cookie of upstream.headers.getSetCookie()) {
    response.headers.append("set-cookie", cookie);
  }

  return response;
}
