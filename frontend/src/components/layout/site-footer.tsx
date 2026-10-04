import Link from "next/link";

import { LOGIN_HREF, publicNavItems } from "@/lib/navigation";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t bg-card">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr] lg:px-8">
        <div className="space-y-4">
          <Logo />
          <p className="max-w-sm text-sm text-pretty text-muted-foreground">
            One place for admissions, courses, enrolment, results and fees for
            students, faculty and administrators.
          </p>
        </div>

        <nav aria-label="Footer" className="space-y-3">
          <h2 className="text-sm font-semibold">Explore</h2>
          <ul className="space-y-2 text-sm">
            {publicNavItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold">Portal</h2>
          <ul className="space-y-2 text-sm">
            <li>
              <Link
                href={LOGIN_HREF}
                className="rounded-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Log in
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t">
        <p className="mx-auto max-w-7xl px-4 py-5 text-center text-xs text-muted-foreground sm:px-6 lg:px-8">
          © {new Date().getFullYear()} University Management System. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
