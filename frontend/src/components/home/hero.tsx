import Link from "next/link";

import { BrandImage } from "@/components/website/brand-image";
import { Button } from "@/components/ui/button";
import type { WebsiteSettings } from "@/types/entities";

/**
 * Hero banner. The gradient underneath is the fallback when no background is
 * configured or the image fails to load; the dark overlay keeps text readable
 * over any photo.
 */
export function Hero({ settings }: { settings: WebsiteSettings }) {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate flex min-h-[28rem] items-center overflow-hidden bg-[linear-gradient(135deg,oklch(0.3_0.12_277),oklch(0.2_0.08_290))] text-white sm:min-h-[34rem] lg:min-h-[40rem]"
    >
      <BrandImage
        src={settings.homepageBackgroundUrl}
        alt=""
        priority
        className="absolute inset-0 -z-20 size-full object-cover object-center"
        fallback={null}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-r from-black/75 via-black/55 to-black/25 sm:from-black/70"
      />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-0 -z-10 h-32 bg-gradient-to-t from-black/40 to-transparent" />

      <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8">
        <div className="max-w-2xl space-y-6">
          <p className="text-xs font-semibold tracking-[0.2em] text-white/80 uppercase">Welcome to</p>
          <h1 id="hero-heading" className="text-4xl leading-tight font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            {settings.universityName}
          </h1>
          <p className="text-lg text-pretty text-white/90 sm:text-xl">{settings.tagline}</p>
          <div className="flex flex-col gap-3 pt-2 sm:flex-row">
            <Button asChild size="lg" className="h-12 bg-white px-6 text-base text-neutral-900 hover:bg-white/90">
              <Link href="/#academic">Explore</Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-12 border-white/70 bg-transparent px-6 text-base text-white hover:bg-white/15 hover:text-white dark:border-white/70 dark:bg-transparent dark:hover:bg-white/15"
            >
              <Link href="/register">Apply Now</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
