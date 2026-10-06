import type { ReactNode } from "react";
import { BookOpenCheck, GraduationCap, ShieldCheck, Users } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { SkipLink } from "@/components/layout/skip-link";
import { BrandImage } from "@/components/website/brand-image";
import { getWebsiteSettings } from "@/lib/api/public-data";

const highlights = [
  { icon: ShieldCheck, text: "Role-based access for administrators, faculty and students" },
  { icon: BookOpenCheck, text: "Enrol in courses with live seat availability" },
  { icon: GraduationCap, text: "Results and fees in one place" },
  { icon: Users, text: "Faculty and departments, always up to date" },
];

/** Split layout: a brand panel on wide screens, the form alone on mobile. */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  const { universityName, logoUrl } = await getWebsiteSettings();

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <SkipLink />

      <aside
        aria-hidden="true"
        className="bg-brand-gradient relative hidden overflow-hidden text-white lg:flex lg:flex-col lg:justify-between lg:p-12"
      >
        <div className="absolute -top-32 -right-32 size-96 rounded-full bg-white/10 blur-2xl" />
        <div className="absolute -bottom-40 -left-24 size-96 rounded-full bg-black/10 blur-3xl" />

        <div className="relative">
          <span
            className={
              logoUrl
                ? "flex size-16 items-center justify-center rounded-2xl bg-white p-2 shadow-lg shadow-black/20"
                : "flex size-12 items-center justify-center rounded-2xl bg-white/15 backdrop-blur"
            }
          >
            <BrandImage
              src={logoUrl}
              alt=""
              className="size-full object-contain"
              priority
              fallback={<GraduationCap className="size-6" />}
            />
          </span>
        </div>

        <div className="relative max-w-md space-y-8">
          <h2 className="text-4xl leading-tight font-bold tracking-tight text-balance">
            Your campus, organised.
          </h2>
          <ul className="space-y-4">
            {highlights.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3 text-white/90">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                  <Icon className="size-4" />
                </span>
                <span className="pt-1 text-sm">{text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/70">{universityName}</p>
      </aside>

      <div className="flex flex-col">
        <header className="flex h-16 items-center px-4 sm:px-6 lg:px-10">
          <Logo name={universityName} logoUrl={logoUrl} />
        </header>

        <main id="main-content" tabIndex={-1} className="flex flex-1 items-start justify-center px-4 pt-4 pb-12 outline-none sm:px-6 sm:pt-10 lg:items-center lg:px-10">
          <div className="w-full max-w-md">{children}</div>
        </main>
      </div>
    </div>
  );
}
