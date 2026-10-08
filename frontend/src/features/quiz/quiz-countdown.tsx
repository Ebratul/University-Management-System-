"use client";

import { Clock } from "lucide-react";

import { formatCountdown } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useNow } from "./use-clock";

/** Time left until `endsAtMs`, judged on the server's clock (`offsetMs` corrects this device). */
export function Countdown({
  endsAtMs,
  offsetMs,
  className,
}: {
  endsAtMs: number;
  offsetMs: number;
  className?: string;
}) {
  const now = useNow(1000);
  const remaining = endsAtMs - (now + offsetMs);
  const tone = remaining <= 60_000 ? "danger" : remaining <= 5 * 60_000 ? "warning" : "normal";

  return (
    <span
      role="timer"
      aria-live="off"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 font-mono text-sm font-semibold tabular-nums transition-colors",
        tone === "normal" && "bg-muted text-foreground",
        tone === "warning" && "bg-warning/25 text-amber-800 dark:text-warning",
        tone === "danger" && "bg-destructive/10 text-destructive animate-pulse",
        className,
      )}
    >
      <Clock className="size-4" aria-hidden="true" />
      {formatCountdown(remaining)}
    </span>
  );
}
