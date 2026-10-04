"use client";

import Link from "next/link";
import { Menu } from "lucide-react";

import { RoleGate } from "@/components/auth/role-gate";
import { useSession } from "@/components/auth/session-provider";
import { LogoutButton } from "@/components/auth/logout-button";
import { Logo } from "@/components/layout/logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { getDisplayName } from "@/lib/auth/user";
import { ROLE_META } from "@/lib/auth/roles";
import { useUiStore } from "@/stores/ui-store";

/**
 * Signed-in header. Navigation items are gated by role with <RoleGate>, so each
 * role sees only its own areas. The API still enforces the same rules.
 */
export function DashboardHeader() {
  const user = useSession();
  const name = getDisplayName(user);
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const mobileNavOpen = useUiStore((state) => state.mobileNavOpen);
  const setMobileNavOpen = useUiStore((state) => state.setMobileNavOpen);

  return (
    <header className="bg-background/85 sticky top-0 z-40 border-b backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
        <Logo />

        <nav aria-label="Portal" className="ml-4 hidden items-center gap-1 md:flex">
          <RoleGate roles={["ADMIN"]}>
            <NavLink href="/admin">Admin overview</NavLink>
          </RoleGate>
          <RoleGate roles={["FACULTY"]}>
            <NavLink href="/faculty">Teaching overview</NavLink>
          </RoleGate>
          <RoleGate roles={["STUDENT"]}>
            <NavLink href="/student">My overview</NavLink>
          </RoleGate>
          <NavLink href="/courses">Course catalogue</NavLink>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-3 sm:flex">
            <Avatar className="size-8">
              <AvatarFallback className="bg-brand-gradient text-xs font-semibold text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col leading-tight">
              <span className="max-w-40 truncate text-sm font-medium">{name}</span>
              <Badge variant="secondary" className="mt-0.5 w-fit text-[10px] uppercase">
                {ROLE_META[user.role].label}
              </Badge>
            </div>
          </div>
          <LogoutButton />
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileNavOpen(true)}
          >
            <Menu className="size-5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="w-[min(20rem,calc(100vw-2rem))] gap-0 p-0">
          <SheetHeader className="border-b p-4">
            <SheetTitle>Portal navigation</SheetTitle>
            <SheetDescription>{ROLE_META[user.role].label} area</SheetDescription>
          </SheetHeader>
          <nav aria-label="Portal mobile" className="flex flex-col gap-1 p-4">
            <RoleGate roles={["ADMIN"]}>
              <NavLink href="/admin" onNavigate={() => setMobileNavOpen(false)}>Admin overview</NavLink>
            </RoleGate>
            <RoleGate roles={["FACULTY"]}>
              <NavLink href="/faculty" onNavigate={() => setMobileNavOpen(false)}>Teaching overview</NavLink>
            </RoleGate>
            <RoleGate roles={["STUDENT"]}>
              <NavLink href="/student" onNavigate={() => setMobileNavOpen(false)}>My overview</NavLink>
            </RoleGate>
            <NavLink href="/courses" onNavigate={() => setMobileNavOpen(false)}>Course catalogue</NavLink>
          </nav>
        </SheetContent>
      </Sheet>
    </header>
  );
}

function NavLink({
  href,
  children,
  onNavigate,
}: {
  href: string;
  children: React.ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="text-muted-foreground hover:bg-muted hover:text-foreground rounded-md px-3 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {children}
    </Link>
  );
}
