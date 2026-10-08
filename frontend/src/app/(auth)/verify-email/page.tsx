import type { Metadata } from "next";

import { VerifyEmailForm } from "@/components/auth/verify-email-form";

export const metadata: Metadata = {
  title: "Verify your email",
  robots: { index: false, follow: true },
};

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";
  const justSent = params.sent === "1";

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Verify your email</h1>
        <p className="text-muted-foreground">One last step: confirm the address you signed up with.</p>
      </div>
      {/* Keyed so a different address starts a fresh form. */}
      <VerifyEmailForm key={email} email={email} justSent={justSent} />
    </div>
  );
}
