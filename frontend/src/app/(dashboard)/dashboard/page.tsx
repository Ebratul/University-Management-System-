import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth/session";
import { homeForRole } from "@/lib/auth/roles";

/** Post-login landing. Sends each role to its own home. */
export default async function DashboardRedirectPage() {
  const user = await getCurrentUser();
  redirect(user ? homeForRole(user.role) : "/login");
}
