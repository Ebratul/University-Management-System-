import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { SectionSubnav } from "@/components/layout/section-subnav";
import { homeForRole } from "@/lib/auth/roles";
import { getCurrentUser } from "@/lib/auth/session";
import { STUDENT_NAV } from "@/lib/auth/nav";

/** Role gate for the student area. Other roles are sent to their own home. */
export default async function StudentLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?reason=expired");
  if (user.role !== "STUDENT") redirect(homeForRole(user.role));

  return (
    <div className="space-y-8">
      <SectionSubnav items={STUDENT_NAV} label="Student sections" root="/student" />
      {children}
    </div>
  );
}
