export type NavItem = {
  label: string;
  href: string;
};

/**
 * Links shown in the public site header and mobile menu. Keep these plain
 * data: they are passed from Server Components to Client Components, and
 * component references (like icons) can't cross that boundary.
 */
export const publicNavItems: NavItem[] = [
  { label: "Courses", href: "/courses" },
  { label: "Departments", href: "/departments" },
  { label: "Faculty", href: "/faculties" },
  { label: "Notices", href: "/notices" },
];

export const LOGIN_HREF = "/login";
