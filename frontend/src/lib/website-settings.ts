import type { WebsiteSettings } from "@/types/entities";

/** Used until the API answers, and whenever it is unreachable. */
export const DEFAULT_WEBSITE_SETTINGS: WebsiteSettings = {
  universityName: "University Management System",
  tagline: "Excellence in education, research and service.",
  logoUrl: null,
  homepageBackgroundUrl: null,
  updatedAt: "1970-01-01T00:00:00.000Z",
};

export const WEBSITE_SETTINGS_TAG = "website-settings";

/** Branding images accepted by the API (see website-settings.router.ts). */
export const BRANDING_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const BRANDING_MAX_BYTES = 5 * 1024 * 1024;
