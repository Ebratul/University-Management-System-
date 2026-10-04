import type { Metadata } from "next";
import Link from "next/link";
import { SearchX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";

// Streamed responses answer 200 even for a missing record (the status line is
// sent before the lookup finishes), so keep these pages out of search indexes.
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 px-4 py-16 sm:px-6">
      <p className="text-primary text-center text-sm font-semibold tracking-wider uppercase">
        Error 404
      </p>
      <EmptyState
        icon={SearchX}
        title="We couldn't find that page"
        description="The link may be broken, or the page may have moved."
        action={
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild className="bg-brand-gradient text-white hover:opacity-90">
              <Link href="/">Back to home</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/courses">Browse courses</Link>
            </Button>
          </div>
        }
      />
    </div>
  );
}
