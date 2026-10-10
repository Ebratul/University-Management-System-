import { z } from "zod";

/**
 * Client-safe environment. Only NEXT_PUBLIC_* values belong here, because
 * Next.js inlines them into the browser bundle. Every key must be read with
 * a literal `process.env.NEXT_PUBLIC_*` access, otherwise the value is not
 * inlined and is undefined in the browser.
 *
 * Secrets and server-only configuration live in `env.server.ts`.
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url({
    error: "NEXT_PUBLIC_APP_URL must be a full URL, e.g. http://localhost:3000",
  }),
  // Optional: without it the "Continue with Google" button is hidden.
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: z.string().optional(),
});

const parsed = publicEnvSchema.safeParse({
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || undefined,
});

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid public environment variables:\n${issues}`);
}

export const publicEnv = parsed.data;
