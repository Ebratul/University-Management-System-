import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Consistent heading + spacing for homepage sections. `id` is the nav anchor target. */
export function HomeSection({
  id,
  eyebrow,
  title,
  description,
  action,
  children,
  muted = false,
}: {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={cn("scroll-mt-20 py-14 sm:py-20", muted && "bg-muted/40")}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl space-y-2">
            <p className="text-primary text-xs font-semibold tracking-wider uppercase">{eyebrow}</p>
            <h2 id={`${id}-heading`} className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
              {title}
            </h2>
            {description ? <p className="text-muted-foreground text-pretty">{description}</p> : null}
          </div>
          {action}
        </div>
        {children}
      </div>
    </section>
  );
}
