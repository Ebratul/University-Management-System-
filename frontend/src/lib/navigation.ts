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

export type MenuLink = { label: string; href: string; description?: string };
export type MenuGroup = { label: string; href: string; links: MenuLink[] };

/**
 * Public mega-menu. Every link points at a route that already exists, or at a
 * section of the homepage (`/#section`) where no dedicated page exists yet.
 * Portal links are protected routes: signed-out visitors are sent to login.
 */
export const publicMenu: MenuGroup[] = [
  {
    label: "Academic",
    href: "/#academic",
    links: [
      { label: "Faculties", href: "/faculties", description: "Meet the people who teach." },
      { label: "Departments", href: "/departments", description: "Explore every department." },
      { label: "Programs & Courses", href: "/courses", description: "Browse the course catalogue." },
      { label: "Academic Calendar", href: "/#academic", description: "Semesters at a glance." },
    ],
  },
  {
    label: "Admission",
    href: "/#admission",
    links: [
      { label: "Admission Overview", href: "/#admission", description: "How to join the university." },
      { label: "Apply Now", href: "/register", description: "Create your account." },
      { label: "Admission Notices", href: "/notices", description: "Deadlines and announcements." },
    ],
  },
  {
    label: "For Students",
    href: "/#students",
    links: [
      { label: "Student Portal", href: "/student", description: "Your dashboard." },
      { label: "Courses", href: "/courses", description: "Find courses to enrol in." },
      { label: "Results", href: "/student/results", description: "Grades and GPA." },
      { label: "Fees & Payments", href: "/student/payments", description: "Pay semester fees." },
      { label: "Notices", href: "/notices", description: "Latest announcements." },
    ],
  },
  {
    label: "For Faculty & Staff",
    href: "/#faculty",
    links: [
      { label: "Faculty Portal", href: "/faculty", description: "Your teaching dashboard." },
      { label: "My Offerings", href: "/faculty/offerings", description: "Manage course offerings." },
      { label: "Faculty Directory", href: "/faculties", description: "Colleagues and departments." },
      { label: "Notices", href: "/notices", description: "Staff announcements." },
    ],
  },
  {
    label: "Research",
    href: "/#research",
    links: [
      { label: "Research Overview", href: "/#research" },
      { label: "Departments", href: "/departments" },
      { label: "Researchers", href: "/faculties" },
    ],
  },
  {
    label: "Alumni",
    href: "/#alumni",
    links: [
      { label: "Alumni Network", href: "/#alumni" },
      { label: "Stay Connected", href: "/login" },
    ],
  },
  {
    label: "Resources",
    href: "/#resources",
    links: [
      { label: "Course Catalogue", href: "/courses" },
      { label: "Departments", href: "/departments" },
      { label: "Important Links", href: "/#resources" },
    ],
  },
  {
    label: "News",
    href: "/notices",
    links: [
      { label: "Latest News", href: "/notices" },
      { label: "Announcements", href: "/#news" },
    ],
  },
];
