"use server";

import { revalidateTag } from "next/cache";

import { getCurrentUser } from "@/lib/auth/session";
import { WEBSITE_SETTINGS_TAG } from "@/lib/website-settings";

/**
 * Refreshes the statically cached public branding after an admin saves. Only
 * admins may trigger it; the data itself is public and is re-read from the API.
 */
export async function revalidateWebsiteSettings() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") return;
  revalidateTag(WEBSITE_SETTINGS_TAG, "max");
}
