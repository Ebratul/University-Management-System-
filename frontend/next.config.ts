import type { NextConfig } from "next";

const backendUrl = process.env.BACKEND_URL;
if (!backendUrl) {
  throw new Error("BACKEND_URL must be set (see frontend/.env.example).");
}

const nextConfig: NextConfig = {
  // This app sits inside a repo that also has a backend lockfile. Pin the
  // Turbopack root to this folder so file tracing and dev caches stay local.
  turbopack: {
    root: import.meta.dirname,
  },
  reactCompiler: true,

  // The rewrite below proxies to the Express API. Next gives up on a proxied
  // request after 30 s by default, which cuts off AI quiz generation (it can
  // take a minute or two). Keep this above the longest legitimate API call.
  experimental: {
    proxyTimeout: 160_000,
  },

  // Same-origin API: the browser calls /api/v1/* on this app, and Next
  // forwards it to Express. Auth cookies stay first-party, so sameSite=lax
  // works and no CORS setup is needed in the browser.
  // Baseline security headers for every page and response. A Content-Security-Policy
  // needs nonces for Next's inline scripts, so it is left for a later step.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${backendUrl}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
