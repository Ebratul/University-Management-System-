import type { Metadata } from "next";

import { WebsiteSettingsManager } from "@/features/website/website-settings-manager";

export const metadata: Metadata = {
  title: "Website management",
};

export default function Page() {
  return <WebsiteSettingsManager />;
}
