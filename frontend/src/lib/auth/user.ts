import type { CurrentUser } from "@/types/entities";

/** Picks the display name from whichever profile the user has. */
export function getDisplayName(user: CurrentUser): string {
  return user.admin?.name ?? user.faculty?.name ?? user.student?.name ?? user.email;
}
