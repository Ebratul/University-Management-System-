"use client";

import { useEffect, useState } from "react";
import { GraduationCap } from "lucide-react";

import { BrandImage } from "@/components/website/brand-image";
import { useWebsiteSettings } from "@/components/website/settings-provider";
import { SPLASH_STORAGE_KEY } from "@/components/website/splash-config";
import { cn } from "@/lib/utils";

const VISIBLE_MS = 3000;
const FADE_MS = 500;

/**
 * Full-screen intro shown once per browser session for about 3 seconds, then
 * fades out over the homepage. Mounted in the public layout, which persists
 * across client-side navigation, so internal links never replay it.
 */
export function SplashScreen() {
  const { universityName, tagline, logoUrl } = useWebsiteSettings();
  const [phase, setPhase] = useState<"visible" | "leaving" | "gone">("visible");

  useEffect(() => {
    try {
      sessionStorage.setItem(SPLASH_STORAGE_KEY, "1");
    } catch {
      // Storage can be blocked (private mode); the splash then shows per page load.
    }

    const leave = setTimeout(() => setPhase("leaving"), VISIBLE_MS);
    const finish = setTimeout(() => setPhase("gone"), VISIBLE_MS + FADE_MS);
    return () => {
      clearTimeout(leave);
      clearTimeout(finish);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <>
      <noscript>
        <style>{"#ums-splash{display:none}"}</style>
      </noscript>
      <div
        id="ums-splash"
        role="status"
        aria-live="polite"
        aria-label={`Loading ${universityName}`}
        style={{ transitionDuration: `${FADE_MS}ms` }}
        className={cn(
          "fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 overflow-hidden px-6 text-center text-white transition-[opacity,transform] ease-out",
          "bg-[radial-gradient(ellipse_at_top,var(--brand-violet),transparent_60%),linear-gradient(160deg,oklch(0.25_0.1_277),oklch(0.16_0.06_277))]",
          phase === "leaving" && "pointer-events-none scale-105 opacity-0",
        )}
      >
        <div className="flex flex-col items-center gap-6 [animation:splash-rise_700ms_ease-out_both]">
          <div className="flex size-28 items-center justify-center rounded-3xl bg-white p-4 shadow-2xl shadow-black/30 sm:size-36">
            <BrandImage
              src={logoUrl}
              alt={`${universityName} logo`}
              className="size-full object-contain"
              priority
              fallback={<GraduationCap aria-hidden="true" className="text-brand-indigo size-3/4" />}
            />
          </div>
          <div className="max-w-xl space-y-2">
            <p className="text-2xl font-bold tracking-tight text-balance sm:text-4xl">{universityName}</p>
            <p className="text-sm text-white/75 text-balance sm:text-base">{tagline}</p>
          </div>
        </div>

        <div aria-hidden="true" className="h-1 w-48 overflow-hidden rounded-full bg-white/20 sm:w-64">
          <div
            className="h-full origin-left rounded-full bg-white"
            style={{ animation: `splash-progress ${VISIBLE_MS}ms linear both` }}
          />
        </div>
      </div>
    </>
  );
}
