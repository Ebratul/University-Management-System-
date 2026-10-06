"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { LOGIN_HREF, type MenuGroup } from "@/lib/navigation";
import { Logo } from "./logo";

/** Slide-out menu with one expandable section per top-level group. */
export function MobileNav({
  groups,
  universityName,
  logoUrl,
}: {
  groups: MenuGroup[];
  universityName: string;
  logoUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-lg" className="xl:hidden" aria-label="Open menu">
          <Menu className="size-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(22rem,calc(100vw-2rem))] gap-0 p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="sr-only">Site menu</SheetTitle>
          <SheetDescription className="sr-only">
            Navigate the university website or sign in.
          </SheetDescription>
          <Logo name={universityName} logoUrl={logoUrl} />
        </SheetHeader>

        <nav aria-label="Mobile" className="flex-1 overflow-y-auto p-2">
          <ul>
            {groups.map((group) => {
              const isOpen = expanded === group.label;
              const panelId = `mobile-${group.label.replace(/\W+/g, "-")}`;
              return (
                <li key={group.label} className="border-b last:border-b-0">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setExpanded(isOpen ? null : group.label)}
                    className="focus-visible:ring-ring/50 flex min-h-12 w-full items-center justify-between rounded-md px-3 text-left text-base font-medium outline-none focus-visible:ring-3"
                  >
                    {group.label}
                    <ChevronDown
                      aria-hidden="true"
                      className={cn("text-muted-foreground size-4 transition-transform", isOpen && "rotate-180")}
                    />
                  </button>
                  <ul id={panelId} hidden={!isOpen} className="space-y-0.5 pb-2 pl-3">
                    {group.links.map((link) => (
                      <li key={link.label}>
                        <Link
                          href={link.href}
                          onClick={close}
                          className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 flex min-h-11 items-center rounded-md px-3 text-sm outline-none focus-visible:ring-3"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t p-4">
          <Button asChild size="lg" className="bg-brand-gradient h-11 w-full text-white hover:opacity-90">
            <Link href={LOGIN_HREF} onClick={close}>
              Log in
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
