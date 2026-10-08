import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { QuizStatus } from "@/types/entities";

// One semantic colour per state, from the theme tokens: draft is neutral,
// upcoming warns, active is the "go" colour, ended recedes.
const STYLES: Record<QuizStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-secondary text-secondary-foreground" },
  UPCOMING: { label: "Upcoming", className: "bg-warning/25 text-amber-800 dark:text-warning" },
  ACTIVE: { label: "Active", className: "bg-success/15 text-success" },
  ENDED: { label: "Ended", className: "bg-muted text-muted-foreground" },
};

export function QuizStatusBadge({ status, className }: { status: QuizStatus; className?: string }) {
  const style = STYLES[status];
  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", style.className, className)}>
      {status === "ACTIVE" ? <span aria-hidden="true" className="bg-success size-1.5 animate-pulse rounded-full" /> : null}
      {style.label}
    </Badge>
  );
}
