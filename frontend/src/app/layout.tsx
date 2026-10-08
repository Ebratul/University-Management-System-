import type { Metadata, Viewport } from "next";
import { Geist_Mono, Inter } from "next/font/google";

import { AppProviders } from "@/components/providers/app-providers";
import { SPLASH_SKIP_SCRIPT } from "@/components/website/splash-config";
import { publicEnv } from "@/lib/env";
// Side-effect import: validates all server env vars when the app boots.
import "@/lib/env.server";
import { cn } from "@/lib/utils";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "University Management System",
    template: "%s | University Management System",
  },
  description:
    "Admissions, courses, enrolment, results and payments for students, faculty and administrators.",
  metadataBase: new URL(publicEnv.NEXT_PUBLIC_APP_URL),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef0ff" },
    { media: "(prefers-color-scheme: dark)", color: "#171433" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // next-themes writes the theme class on <html> before hydration, so the
    // server markup and client markup can differ by that one attribute.
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("h-full antialiased", inter.variable, geistMono.variable)}
    >
      <head>
        {/* Decides before the first paint whether the homepage splash is skipped
            (already seen this session, or not the homepage), so returning visitors
            never see it flash. It lives here, in the root layout, on purpose: React
            warns when a <script> element is created on the client, which happened
            when it sat in the public layout and the visitor navigated into it. The
            root layout is only ever rendered by the server. */}
        <script dangerouslySetInnerHTML={{ __html: SPLASH_SKIP_SCRIPT }} />
      </head>
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
