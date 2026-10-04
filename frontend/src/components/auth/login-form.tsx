"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Eye, EyeOff, Loader2 } from "lucide-react";

import { FieldMessage } from "@/components/forms/field-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { authApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/errors";
import { homeForRole } from "@/lib/auth/roles";
import { loginSchema } from "@/lib/validations/auth";

export function LoginForm({ next, expired }: { next: string | null; expired: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const login = useApiMutation({
    mutationFn: authApi.login,
    notifyError: false,
    onSuccess: (session) => {
      // Drop anything cached for a previous visitor before entering the portal.
      queryClient.clear();
      router.replace(next ?? homeForRole(session.role));
      router.refresh();
    },
  });

  const form = useForm({
    defaultValues: { email: "", password: "" },
    validators: { onSubmit: loginSchema },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        await login.mutateAsync(value);
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
      {expired ? (
        <div role="status" className="bg-warning/15 text-foreground flex gap-2 rounded-lg border border-warning/40 p-3 text-sm">
          <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Your session has expired. Please log in again.
        </div>
      ) : null}

      {serverError ? (
        <div role="alert" className="bg-destructive/10 text-destructive rounded-lg p-3 text-sm">
          {serverError}
        </div>
      ) : null}

      <form.Field name="email">
        {(field) => {
          const errors = field.state.meta.isTouched ? field.state.meta.errors : [];
          const describedBy = errors.length ? `${field.name}-error` : undefined;
          return (
            <div className="space-y-2">
              <Label htmlFor={field.name}>Email</Label>
              <Input
                id={field.name}
                name={field.name}
                type="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@university.edu"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
                aria-invalid={errors.length > 0}
                aria-describedby={describedBy}
                className="h-11"
              />
              <FieldMessage id={`${field.name}-error`} errors={errors} />
            </div>
          );
        }}
      </form.Field>

      <form.Field name="password">
        {(field) => {
          const errors = field.state.meta.isTouched ? field.state.meta.errors : [];
          const describedBy = errors.length ? `${field.name}-error` : undefined;
          return (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor={field.name}>Password</Label>
              </div>
              <div className="relative">
                <Input
                  id={field.name}
                  name={field.name}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(event) => field.handleChange(event.target.value)}
                  aria-invalid={errors.length > 0}
                  aria-describedby={describedBy}
                  className="h-11 pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md outline-none focus-visible:ring-3"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              <FieldMessage id={`${field.name}-error`} errors={errors} />
            </div>
          );
        }}
      </form.Field>

      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <Button
            type="submit"
            size="lg"
            disabled={!canSubmit || isSubmitting || login.isPending}
            className="bg-brand-gradient h-11 w-full text-white hover:opacity-90"
          >
            {isSubmitting || login.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Signing in…
              </>
            ) : (
              "Log in"
            )}
          </Button>
        )}
      </form.Subscribe>

      <p className="text-muted-foreground text-center text-sm">
        New student?{" "}
        <Link href="/register" className="text-primary font-medium underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}
