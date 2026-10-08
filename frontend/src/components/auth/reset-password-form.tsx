"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { CodeInput } from "@/components/auth/code-input";
import { ResendCodeButton } from "@/components/auth/resend-code-button";
import { TextInputField } from "@/components/forms/form-fields";
import { Button } from "@/components/ui/button";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { authApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/errors";
import { resetPasswordSchema } from "@/lib/validations/auth";

/** Enter the emailed code and choose a new password. Afterwards, log in again. */
export function ResetPasswordForm({ email, justSent }: { email: string; justSent: boolean }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const reset = useApiMutation({
    mutationFn: authApi.resetPassword,
    notifyError: false,
    successMessage: "Password updated. Log in with your new password.",
    onSuccess: () => router.replace("/login"),
  });

  const form = useForm({
    defaultValues: { email, code: "", newPassword: "", confirmPassword: "" },
    validators: { onSubmit: resetPasswordSchema },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        await reset.mutateAsync({ email: value.email.trim(), code: value.code, newPassword: value.newPassword });
      } catch (error) {
        setServerError(toApiError(error).message);
      }
    },
  });

  return (
    <form
      noValidate
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <div className="bg-brand-indigo/8 flex items-start gap-3 rounded-xl p-4 text-sm">
        <MailCheck className="text-brand-indigo mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <p>If an account exists for that email, a 6-digit code is on its way. It expires in 10 minutes.</p>
      </div>

      {serverError ? (
        <div role="alert" className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
          {serverError}
        </div>
      ) : null}

      <form.Field name="email">
        {(field) => <TextInputField field={field} label="Email" type="email" autoComplete="email" placeholder="you@university.edu" />}
      </form.Field>

      <form.Field name="code">
        {(field) => (
          <CodeInput value={field.state.value} onChange={field.handleChange} onBlur={field.handleBlur} errors={field.state.meta.isTouched ? field.state.meta.errors : []} autoFocus={Boolean(email)} />
        )}
      </form.Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <form.Field name="newPassword">
          {(field) => <TextInputField field={field} label="New password" type="password" autoComplete="new-password" hint="8+ characters with upper, lower, number and symbol." />}
        </form.Field>
        <form.Field name="confirmPassword">
          {(field) => <TextInputField field={field} label="Confirm password" type="password" autoComplete="new-password" />}
        </form.Field>
      </div>

      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting, state.values.email] as const}>
        {([canSubmit, isSubmitting, currentEmail]) => (
          <div className="space-y-3">
            <Button type="submit" size="lg" disabled={!canSubmit || isSubmitting || reset.isPending} className="bg-brand-gradient h-11 w-full text-white hover:opacity-90">
              {isSubmitting || reset.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Updating…
                </>
              ) : (
                "Set new password"
              )}
            </Button>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <ResendCodeButton
                startCoolingDown={justSent}
                onResend={() => {
                  if (!currentEmail) {
                    toast.error("Enter your email first.");
                    return Promise.reject(new Error("Enter your email first."));
                  }
                  return authApi.forgotPassword(currentEmail).catch((error) => {
                    throw toApiError(error);
                  });
                }}
              />
              <Link href="/login" className="text-primary font-medium underline-offset-4 hover:underline">
                Back to log in
              </Link>
            </div>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
