"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";

import { CodeInput } from "@/components/auth/code-input";
import { ResendCodeButton } from "@/components/auth/resend-code-button";
import { TextInputField } from "@/components/forms/form-fields";
import { Button } from "@/components/ui/button";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { authApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/errors";
import { verifyEmailSchema } from "@/lib/validations/auth";

/** Step two of sign-up: enter the code that was emailed. A correct code signs the student in. */
export function VerifyEmailForm({ email, justSent }: { email: string; justSent: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const verify = useApiMutation({
    mutationFn: authApi.verifyEmail,
    notifyError: false,
    successMessage: "Email verified. Welcome to the university portal!",
    onSuccess: () => {
      // The API has set the session cookies; start from a clean cache.
      queryClient.clear();
      router.replace("/");
      router.refresh();
    },
  });

  const form = useForm({
    defaultValues: { email, code: "" },
    validators: { onSubmit: verifyEmailSchema },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        await verify.mutateAsync(value);
      } catch (error) {
        setServerError(toApiError(error).message);
      }
    },
  });

  return (
    <form
      noValidate
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <div className="bg-brand-indigo/8 flex items-start gap-3 rounded-xl p-4 text-sm">
        <MailCheck className="text-brand-indigo mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <p>
          {email ? (
            <>
              We sent a 6-digit code to <strong className="break-all">{email}</strong>. It expires in 10 minutes.
            </>
          ) : (
            "Enter the email you registered with and the 6-digit code we sent to it."
          )}
        </p>
      </div>

      {serverError ? (
        <div role="alert" className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
          {serverError}
        </div>
      ) : null}

      {email ? null : (
        <form.Field name="email">
          {(field) => <TextInputField field={field} label="Email" type="email" autoComplete="email" placeholder="you@university.edu" />}
        </form.Field>
      )}

      <form.Field name="code">
        {(field) => (
          <CodeInput
            value={field.state.value}
            onChange={field.handleChange}
            onBlur={field.handleBlur}
            errors={field.state.meta.isTouched ? field.state.meta.errors : []}
            autoFocus
          />
        )}
      </form.Field>

      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting, state.values.email] as const}>
        {([canSubmit, isSubmitting, currentEmail]) => (
          <div className="space-y-3">
            <Button
              type="submit"
              size="lg"
              disabled={!canSubmit || isSubmitting || verify.isPending}
              className="bg-brand-gradient h-11 w-full text-white hover:opacity-90"
            >
              {isSubmitting || verify.isPending ? (
                <>
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                  Verifying…
                </>
              ) : (
                "Verify and continue"
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
                  return authApi.resendVerification(currentEmail);
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
