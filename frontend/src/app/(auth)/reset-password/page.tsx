import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Reset password",
  robots: { index: false, follow: true },
};

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";
  const justSent = params.sent === "1";

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Choose a new password</h1>
        <p className="text-muted-foreground">Enter the code from your email, then set a new password.</p>
      </div>
      <ResetPasswordForm key={email} email={email} justSent={justSent} />
    </div>
  );
}
