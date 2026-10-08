import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AvailableCourseState, InvoiceStatus, RegistrationStatus, RegistrationWindowState } from "@/types/entities";

// One semantic colour per state, from the theme tokens (same scheme as quiz status).
const REGISTRATION: Record<RegistrationStatus, { label: string; className: string }> = {
  DRAFT: { label: "Draft", className: "bg-secondary text-secondary-foreground" },
  SUBMITTED: { label: "Awaiting payment", className: "bg-warning/25 text-amber-800 dark:text-warning" },
  PAYMENT_PENDING: { label: "Payment pending", className: "bg-brand-sky/15 text-brand-sky" },
  PAID: { label: "Paid", className: "bg-success/15 text-success" },
  CONFIRMED: { label: "Confirmed", className: "bg-success/15 text-success" },
  CANCELLED: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
  REJECTED: { label: "Rejected", className: "bg-destructive/10 text-destructive" },
  EXPIRED: { label: "Expired", className: "bg-muted text-muted-foreground" },
};

const INVOICE: Record<InvoiceStatus, { label: string; className: string }> = {
  UNPAID: { label: "Unpaid", className: "bg-warning/25 text-amber-800 dark:text-warning" },
  PENDING: { label: "Payment in progress", className: "bg-brand-sky/15 text-brand-sky" },
  PAID: { label: "Paid", className: "bg-success/15 text-success" },
  FAILED: { label: "Payment failed", className: "bg-destructive/10 text-destructive" },
  CANCELLED: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
  EXPIRED: { label: "Expired", className: "bg-muted text-muted-foreground" },
};

export function RegistrationStatusBadge({ status, className }: { status: RegistrationStatus; className?: string }) {
  const s = REGISTRATION[status];
  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", s.className, className)}>
      {s.label}
    </Badge>
  );
}

export function InvoiceStatusBadge({ status, className }: { status: InvoiceStatus; className?: string }) {
  const s = INVOICE[status];
  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", s.className, className)}>
      {s.label}
    </Badge>
  );
}

const COURSE_STATE: Record<Exclude<AvailableCourseState, "AVAILABLE">, { label: string; className: string }> = {
  COURSE_FULL: { label: "Full", className: "bg-destructive/10 text-destructive" },
  PREREQUISITE_MISSING: { label: "Prerequisite missing", className: "bg-warning/25 text-amber-800 dark:text-warning" },
  ALREADY_COMPLETED: { label: "Already completed", className: "bg-muted text-muted-foreground" },
  ALREADY_REGISTERED: { label: "Registered", className: "bg-success/15 text-success" },
};

export function CourseStateBadge({ state }: { state: AvailableCourseState }) {
  if (state === "AVAILABLE") return null;
  const s = COURSE_STATE[state];
  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", s.className)}>
      {s.label}
    </Badge>
  );
}

export const WINDOW_LABEL: Record<RegistrationWindowState, string> = {
  NOT_CONFIGURED: "Not open",
  NOT_OPEN: "Opens soon",
  OPEN: "Open",
  LATE: "Late registration",
  CLOSED: "Closed",
};

export function WindowStateBadge({ state }: { state: RegistrationWindowState }) {
  const className =
    state === "OPEN"
      ? "bg-success/15 text-success"
      : state === "LATE"
        ? "bg-warning/25 text-amber-800 dark:text-warning"
        : state === "NOT_OPEN"
          ? "bg-brand-sky/15 text-brand-sky"
          : "bg-muted text-muted-foreground";
  return (
    <Badge variant="outline" className={cn("border-transparent font-medium", className)}>
      {WINDOW_LABEL[state]}
    </Badge>
  );
}
