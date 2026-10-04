"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";

import { Toaster } from "@/components/ui/sonner";

import { QueryProvider } from "./query-provider";
import { TooltipProvider } from "@/components/ui/tooltip";

/**
 * Client-side providers shared by every route. Kept in one place so the root
 * layout can stay a Server Component.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <QueryProvider>
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        <Toaster position="top-right" closeButton richColors />
      </QueryProvider>
    </ThemeProvider>
  );
}
