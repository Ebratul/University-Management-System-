import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SkipLink } from "@/components/layout/skip-link";
import { SplashScreen } from "@/components/website/splash-screen";
import { WebsiteSettingsSeed } from "@/components/website/settings-provider";
import { getWebsiteSettings } from "@/lib/api/public-data";

export default async function PublicLayout({ children }: { children: ReactNode }) {
  // One cached server read; the client seeds React Query with it (no extra request).
  const settings = await getWebsiteSettings();

  return (
    <WebsiteSettingsSeed settings={settings}>
      <SplashScreen />
      <SkipLink />
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col outline-none">
        {children}
      </main>
      <SiteFooter settings={settings} />
    </WebsiteSettingsSeed>
  );
}
