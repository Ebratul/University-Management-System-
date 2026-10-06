import Link from "next/link";
import { GraduationCap } from "lucide-react";

import { BrandImage } from "@/components/website/brand-image";
import { cn } from "@/lib/utils";

type LogoProps = {
  className?: string;
  /** Admin-configured branding. Omit to show the default mark and name. */
  name?: string;
  logoUrl?: string | null;
};

function DefaultMark() {
  return (
    <span
      aria-hidden="true"
      className="bg-brand-gradient flex size-9 items-center justify-center rounded-xl text-white shadow-md shadow-brand-indigo/25 transition-transform group-hover:-rotate-6"
    >
      <GraduationCap className="size-5" />
    </span>
  );
}

export function Logo({ className, name, logoUrl }: LogoProps) {
  const branded = Boolean(name);

  return (
    <Link
      href="/"
      aria-label={branded ? `${name} home` : undefined}
      className={cn(
        "group flex min-w-0 items-center gap-2.5 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
    >
      <BrandImage
        src={logoUrl}
        alt=""
        className="size-9 shrink-0 rounded-md object-contain"
        fallback={<DefaultMark />}
        priority
      />
      <span className="flex min-w-0 flex-col leading-none">
        <span className="truncate text-base font-bold tracking-tight">{branded ? name : "UMS"}</span>
        {branded ? null : (
          <span className="hidden text-[11px] font-medium text-muted-foreground sm:block">
            University Management
          </span>
        )}
      </span>
    </Link>
  );
}
