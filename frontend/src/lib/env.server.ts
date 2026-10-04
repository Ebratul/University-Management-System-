import "server-only";

import { z } from "zod";

import { publicEnv } from "@/lib/env";

/**
 * Server-only environment, validated once at boot. Importing this module from
 * a Server Component, route handler or server action validates everything;
 * a missing or malformed variable stops the server with a readable message
 * instead of failing on the first request that needs it.
 *
 * `import "server-only"` makes the build fail if a client component imports
 * this file, which keeps the demo passwords out of the browser bundle.
 */
const demoEmail = z.email({ error: "must be a valid email address" });
const demoPassword = z.string().min(1, { error: "must not be empty" });

const serverEnvSchema = z.object({
  BACKEND_URL: z.url({
    error: "BACKEND_URL must be a full URL, e.g. http://localhost:5000",
  }),
  DEMO_ADMIN_EMAIL: demoEmail,
  DEMO_ADMIN_PASSWORD: demoPassword,
  DEMO_FACULTY_EMAIL: demoEmail,
  DEMO_FACULTY_PASSWORD: demoPassword,
  DEMO_STUDENT_EMAIL: demoEmail,
  DEMO_STUDENT_PASSWORD: demoPassword,
});

const parsed = serverEnvSchema.safeParse({
  BACKEND_URL: process.env.BACKEND_URL,
  DEMO_ADMIN_EMAIL: process.env.DEMO_ADMIN_EMAIL,
  DEMO_ADMIN_PASSWORD: process.env.DEMO_ADMIN_PASSWORD,
  DEMO_FACULTY_EMAIL: process.env.DEMO_FACULTY_EMAIL,
  DEMO_FACULTY_PASSWORD: process.env.DEMO_FACULTY_PASSWORD,
  DEMO_STUDENT_EMAIL: process.env.DEMO_STUDENT_EMAIL,
  DEMO_STUDENT_PASSWORD: process.env.DEMO_STUDENT_PASSWORD,
});

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new Error(`Invalid server environment variables:\n${issues}`);
}

export const serverEnv = {
  ...parsed.data,
  ...publicEnv,
};

export const demoCredentials = {
  ADMIN: {
    email: parsed.data.DEMO_ADMIN_EMAIL,
    password: parsed.data.DEMO_ADMIN_PASSWORD,
  },
  FACULTY: {
    email: parsed.data.DEMO_FACULTY_EMAIL,
    password: parsed.data.DEMO_FACULTY_PASSWORD,
  },
  STUDENT: {
    email: parsed.data.DEMO_STUDENT_EMAIL,
    password: parsed.data.DEMO_STUDENT_PASSWORD,
  },
} as const;
