import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { SessionProvider } from "@/components/auth/session-provider";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SkipLink } from "@/components/layout/skip-link";
import { getCurrentUser } from "@/lib/auth/session";

/**
 * Every signed-in area shares this layout. It is dynamic (per visitor), so it
 * never gets served from the static cache. The proxy has already rotated any
 * expired session; a user still missing here means the session is gone.
 */
export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?reason=expired");

  return (
    <SessionProvider user={user}>
      <div className="bg-muted/30 flex min-h-dvh flex-col">
        <SkipLink />
        <DashboardHeader />
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 outline-none sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </SessionProvider>
  );
}
