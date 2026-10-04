import Link from "next/link";

import { Button } from "@/components/ui/button";
import { LOGIN_HREF, publicNavItems } from "@/lib/navigation";
import { Logo } from "./logo";
import { MobileNav } from "./mobile-nav";
import { NavLinks } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";

/**
 * Server Component. Only the interactive pieces (active link, theme toggle,
 * mobile sheet) ship JavaScript.
 */
export function SiteHeader() {
  return (
    <header className="bg-background/80 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Logo />

        <NavLinks items={publicNavItems} className="ml-4 hidden md:block" />

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <Button asChild className="bg-brand-gradient hidden text-white shadow-sm shadow-brand-violet/30 hover:opacity-90 sm:inline-flex">
            <Link href={LOGIN_HREF}>Log in</Link>
          </Button>
          <MobileNav items={publicNavItems} />
        </div>
      </div>
    </header>
  );
}
