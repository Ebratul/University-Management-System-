import type { Metadata } from "next";

import { DemoLoginPanel } from "@/components/auth/demo-login-panel";
import { LoginForm } from "@/components/auth/login-form";
import { Separator } from "@/components/ui/separator";
import { safeInternalPath } from "@/lib/auth/roles";

export const metadata: Metadata = {
  title: "Log in",
  description: "Sign in to the University Management System portal.",
  // Crawlable (not blocked in robots.txt), but kept out of search results.
  robots: { index: false, follow: true },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeInternalPath(typeof params.next === "string" ? params.next : null);
  const expired = params.reason === "expired";

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground">Log in with your university account to continue.</p>
      </div>

      <LoginForm next={next} expired={expired} />

      <div className="flex items-center gap-4" aria-hidden="true">
        <Separator className="flex-1" />
        <span className="text-muted-foreground text-xs font-medium uppercase">or try a demo</span>
        <Separator className="flex-1" />
      </div>

      <DemoLoginPanel next={next} />
    </div>
  );
}
