import type { Metadata } from "next";

import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Create account",
  description: "Register as a student to enrol in courses and pay fees.",
  robots: { index: false, follow: true },
};

export default function RegisterPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Create your student account</h1>
        <p className="text-muted-foreground">
          Faculty and administrator accounts are created by the university.
        </p>
      </div>

      <RegisterForm />
    </div>
  );
}
