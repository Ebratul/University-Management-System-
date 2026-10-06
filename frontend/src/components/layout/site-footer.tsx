import Link from "next/link";

import { LOGIN_HREF, publicMenu } from "@/lib/navigation";
import type { WebsiteSettings } from "@/types/entities";
import { Logo } from "./logo";

const linkClass =
  "rounded-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50";

export function SiteFooter({ settings }: { settings: WebsiteSettings }) {
  const columns = publicMenu.filter((group) =>
    ["Academic", "Admission", "For Students", "Resources"].includes(group.label),
  );

  return (
    <footer className="mt-auto border-t bg-card">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.5fr_repeat(4,1fr)] lg:px-8">
        <div className="space-y-4 md:col-span-2 lg:col-span-1">
          <Logo name={settings.universityName} logoUrl={settings.logoUrl} />
          <p className="max-w-sm text-sm text-pretty text-muted-foreground">{settings.tagline}</p>
        </div>

        {columns.map((group) => (
          <nav key={group.label} aria-label={`Footer: ${group.label}`} className="space-y-3">
            <h2 className="text-sm font-semibold">{group.label}</h2>
            <ul className="space-y-2 text-sm">
              {group.links.map((link) => (
                <li key={link.label}>
                  <Link href={link.href} className={linkClass}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}

        <div className="space-y-3 lg:col-start-2 lg:row-start-2">
          <h2 className="text-sm font-semibold">Portal</h2>
          <ul className="space-y-2 text-sm">
            <li>
              <Link href={LOGIN_HREF} className={linkClass}>
                Log in
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t">
        <p className="mx-auto max-w-7xl px-4 py-5 text-center text-xs text-muted-foreground sm:px-6 lg:px-8">
          © {new Date().getFullYear()} {settings.universityName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
