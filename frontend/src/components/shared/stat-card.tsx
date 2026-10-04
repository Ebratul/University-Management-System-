import type { LucideIcon } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Full class names (not built from template strings) so Tailwind can see them.
const toneStyles = {
  indigo: { chip: "bg-brand-indigo/12 text-brand-indigo", bar: "bg-brand-indigo" },
  violet: { chip: "bg-brand-violet/12 text-brand-violet", bar: "bg-brand-violet" },
  teal: { chip: "bg-brand-teal/15 text-brand-teal", bar: "bg-brand-teal" },
  amber: { chip: "bg-brand-amber/25 text-amber-700 dark:text-brand-amber", bar: "bg-brand-amber" },
  rose: { chip: "bg-brand-rose/12 text-brand-rose", bar: "bg-brand-rose" },
  sky: { chip: "bg-brand-sky/15 text-brand-sky", bar: "bg-brand-sky" },
} as const;

export type StatTone = keyof typeof toneStyles;

type StatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  tone?: StatTone;
  className?: string;
};

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = "indigo",
  className,
}: StatCardProps) {
  const styles = toneStyles[tone];

  return (
    <Card className={cn("relative overflow-hidden", className)}>
      <span
        aria-hidden="true"
        className={cn("absolute inset-x-0 top-0 h-1", styles.bar)}
      />
      <CardContent className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-muted-foreground truncate text-sm font-medium">{label}</p>
          <p className="text-2xl font-bold tabular-nums">{value}</p>
          {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
        </div>
        <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", styles.chip)}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </CardContent>
    </Card>
  );
}
