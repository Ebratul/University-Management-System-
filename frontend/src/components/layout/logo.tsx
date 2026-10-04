import Link from "next/link";
import { GraduationCap } from "lucide-react";

import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={cn(
        "group flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className="bg-brand-gradient flex size-9 items-center justify-center rounded-xl text-white shadow-md shadow-brand-indigo/25 transition-transform group-hover:-rotate-6"
      >
        <GraduationCap className="size-5" />
      </span>
      <span className="flex flex-col leading-none">
        <span className="text-base font-bold tracking-tight">UMS</span>
        <span className="hidden text-[11px] font-medium text-muted-foreground sm:block">
          University Management
        </span>
      </span>
    </Link>
  );
}
