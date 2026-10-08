import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Forgot password",
  robots: { index: false, follow: true },
};

export default function ForgotPasswordPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Forgot your password?</h1>
        <p className="text-muted-foreground">Enter your account email and we will send you a 6-digit code to reset it.</p>
      </div>
      <ForgotPasswordForm />
    </div>
  );
}
