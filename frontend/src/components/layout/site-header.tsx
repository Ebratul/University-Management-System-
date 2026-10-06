"use client";

import Link from "next/link";

import { Button } from "@/components/ui/button";
import { useWebsiteSettings } from "@/components/website/settings-provider";
import { LOGIN_HREF, publicMenu } from "@/lib/navigation";
import { Logo } from "./logo";
import { MegaNav } from "./mega-nav";
import { MobileNav } from "./mobile-nav";
import { ThemeToggle } from "./theme-toggle";

/**
 * Public site header. Branding comes from the shared website-settings query,
 * so an admin change shows up here without a page reload.
 */
export function SiteHeader() {
  const { universityName, logoUrl } = useWebsiteSettings();

  return (
    <header className="bg-background/90 supports-[backdrop-filter]:bg-background/70 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Logo name={universityName} logoUrl={logoUrl} className="max-w-[14rem] sm:max-w-xs" />

        <MegaNav groups={publicMenu} className="ml-2 hidden xl:block" />

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <ThemeToggle />
          <Button asChild className="bg-brand-gradient hidden text-white shadow-sm shadow-brand-violet/30 hover:opacity-90 sm:inline-flex">
            <Link href={LOGIN_HREF}>Log in</Link>
          </Button>
          <MobileNav groups={publicMenu} universityName={universityName} logoUrl={logoUrl} />
        </div>
      </div>
    </header>
  );
}
