"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { LOGIN_HREF, type NavItem } from "@/lib/navigation";
import { NavLinks } from "./nav-links";
import { Logo } from "./logo";

export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
          <Menu className="size-5" aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[min(20rem,calc(100vw-2rem))] gap-0 p-0">
        <SheetHeader className="border-b p-4">
          <SheetTitle className="sr-only">Site menu</SheetTitle>
          <SheetDescription className="sr-only">
            Navigate the university website or sign in.
          </SheetDescription>
          <Logo />
        </SheetHeader>

        <div className="flex flex-1 flex-col gap-6 p-4">
          <NavLinks items={items} orientation="vertical" onNavigate={close} />
          <Button asChild size="lg" className="bg-brand-gradient w-full text-white hover:opacity-90">
            <Link href={LOGIN_HREF} onClick={close}>
              Log in
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
