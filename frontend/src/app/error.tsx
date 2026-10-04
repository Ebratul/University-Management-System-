"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

type ErrorPageProps = {
  error: Error & { digest?: string };
  retry: () => void;
};

/**
 * Route-level error boundary. It catches errors thrown while rendering this
 * segment and its children. The root layout is covered by global-error.tsx.
 */
export default function ErrorPage({ error, retry }: ErrorPageProps) {
  useEffect(() => {
    // Surface the full error for developers. Users only see the message below.
    console.error(error);
  }, [error]);

  return (
    <div
      role="alert"
      className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-5 px-4 py-16 text-center"
    >
      <span className="bg-destructive/10 text-destructive flex size-14 items-center justify-center rounded-full">
        <TriangleAlert className="size-7" aria-hidden="true" />
      </span>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
        <p className="text-muted-foreground text-pretty">
          This page could not be displayed. Try again, or head back home if the
          problem continues.
        </p>
        {error.digest ? (
          <p className="text-muted-foreground font-mono text-xs">Reference: {error.digest}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={() => retry()} className="bg-brand-gradient text-white hover:opacity-90">
          <RotateCcw className="size-4" aria-hidden="true" />
          Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Go to home</Link>
        </Button>
      </div>
    </div>
  );
}
