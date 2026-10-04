import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { SectionSubnav } from "@/components/layout/section-subnav";
import { ADMIN_NAV } from "@/lib/auth/nav";
import { getCurrentUser } from "@/lib/auth/session";
import { homeForRole } from "@/lib/auth/roles";

/**
 * Role gate for the admin area. Only ADMIN users may render these pages.
 * Anyone else is sent to their own home.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?reason=expired");
  if (user.role !== "ADMIN") redirect(homeForRole(user.role));

  return (
    <div className="space-y-8">
      <SectionSubnav items={ADMIN_NAV} label="Administration sections" root="/admin" />
      {children}
    </div>
  );
}
