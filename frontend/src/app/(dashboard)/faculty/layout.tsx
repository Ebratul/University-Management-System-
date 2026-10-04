import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { SectionSubnav } from "@/components/layout/section-subnav";
import { homeForRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { FACULTY_NAV } from "@/lib/auth/nav";

/** Role gate for the faculty area. Other roles are sent to their own home. */
export default async function FacultyLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?reason=expired");
  if (user.role !== "FACULTY") redirect(homeForRole(user.role));

  return (
    <div className="space-y-8">
      <SectionSubnav items={FACULTY_NAV} label="Faculty sections" root="/faculty" />
      {children}
    </div>
  );
}
