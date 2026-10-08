"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { Loader2 } from "lucide-react";

import { TextInputField } from "@/components/forms/form-fields";
import { Button } from "@/components/ui/button";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { authApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/errors";
import { forgotPasswordSchema } from "@/lib/validations/auth";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const request = useApiMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
    notifyError: false,
    // The same message whether or not the address has an account.
    successMessage: "If an account exists for that email, we have sent it a reset code.",
  });

  const form = useForm({
    defaultValues: { email: "" },
    validators: { onSubmit: forgotPasswordSchema },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        const email = value.email.trim();
        await request.mutateAsync(email);
        router.push(`/reset-password?email=${encodeURIComponent(email)}&sent=1`);
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
      {serverError ? (
        <div role="alert" className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
          {serverError}
        </div>
      ) : null}

      <form.Field name="email">
        {(field) => <TextInputField field={field} label="Email" type="email" autoComplete="email" placeholder="you@university.edu" className="[&_input]:h-11" />}
      </form.Field>

      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <Button type="submit" size="lg" disabled={!canSubmit || isSubmitting || request.isPending} className="bg-brand-gradient h-11 w-full text-white hover:opacity-90">
            {isSubmitting || request.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Sending…
              </>
            ) : (
              "Email me a code"
            )}
          </Button>
        )}
      </form.Subscribe>

      <p className="text-muted-foreground text-center text-sm">
        Remembered it?{" "}
        <Link href="/login" className="text-primary font-medium underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}
