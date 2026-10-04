"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Loader2, ShieldCheck, Users, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { postLocal } from "@/lib/api/client";
import { ROLE_META } from "@/lib/auth/roles";
import type { Role } from "@/types/entities";

const demoAccounts: { role: Role; segment: string; icon: LucideIcon; tone: string }[] = [
  { role: "ADMIN", segment: "admin", icon: ShieldCheck, tone: "bg-brand-indigo/12 text-brand-indigo" },
  { role: "FACULTY", segment: "faculty", icon: Users, tone: "bg-brand-teal/15 text-brand-teal" },
  { role: "STUDENT", segment: "student", icon: GraduationCap, tone: "bg-brand-amber/25 text-amber-700 dark:text-brand-amber" },
];

type DemoLoginResult = { role: Role; redirectTo: string };

/** One-click sign-in for the three seeded demo accounts. Credentials stay on the server. */
export function DemoLoginPanel({ next }: { next: string | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const demoLogin = useApiMutation<DemoLoginResult, string>({
    mutationFn: (segment) => postLocal<DemoLoginResult>(`/api/demo-login/${segment}`),
    onSuccess: (result) => {
      queryClient.clear();
      router.replace(next ?? result.redirectTo);
      router.refresh();
    },
  });

  const activeSegment = demoLogin.isPending ? demoLogin.variables : undefined;

  return (
    <section aria-labelledby="demo-login-heading" className="space-y-4">
      <div className="space-y-1">
        <h2 id="demo-login-heading" className="text-sm font-semibold">
          Quick demo login
        </h2>
        <p className="text-muted-foreground text-xs">
          One click signs you in to a seeded account for each role.
        </p>
      </div>

      <div className="grid gap-3">
        {demoAccounts.map(({ role, segment, icon: Icon, tone }) => {
          const busy = activeSegment === segment;
          return (
            <Button
              key={role}
              type="button"
              variant="outline"
              disabled={demoLogin.isPending}
              onClick={() => demoLogin.mutate(segment)}
              className="hover:border-primary/40 h-auto justify-start gap-3 px-3 py-3 text-left whitespace-normal"
            >
              <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                {busy ? <Loader2 className="size-5 animate-spin" aria-hidden="true" /> : <Icon className="size-5" aria-hidden="true" />}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold">Continue as {ROLE_META[role].label}</span>
                <span className="text-muted-foreground text-xs">{ROLE_META[role].description}</span>
              </span>
            </Button>
          );
        })}
      </div>
    </section>
  );
}
