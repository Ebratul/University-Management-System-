"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { FieldMessage } from "@/components/forms/field-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { authApi, catalogApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";
import { homeForRole } from "@/lib/auth/roles";
import { registerSchema, toRegisterPayload, type RegisterFormInput } from "@/lib/validations/auth";

const emptyValues: RegisterFormInput = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  phone: "",
  dateOfBirth: "",
  departmentId: "",
  admissionSemesterId: "",
};

export function RegisterForm() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const departments = useApiQuery({
    queryKey: queryKeys.departments.list({ limit: 100, sortBy: "name", sortOrder: "asc" }),
    queryFn: catalogApi.departments,
  });
  const semesters = useApiQuery({
    queryKey: queryKeys.semesters.list({ limit: 100, sortBy: "year", sortOrder: "desc" }),
    queryFn: catalogApi.semesters,
  });

  const register = useApiMutation({
    mutationFn: (values: RegisterFormInput) => authApi.register(toRegisterPayload(values)),
    notifyError: false,
    successMessage: "Account created. Welcome!",
    onSuccess: (session) => {
      queryClient.clear();
      router.replace(homeForRole(session.role));
      router.refresh();
    },
  });

  const form = useForm({
    defaultValues: emptyValues,
    validators: { onSubmit: registerSchema },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        await register.mutateAsync(value);
      } catch (error) {
        const apiError = toApiError(error);
        // Field-level messages from the API (`errors[]`) are shown on the form.
        setServerError(apiError.message);
      }
    },
  });

  const catalogReady = departments.isSuccess && semesters.isSuccess;

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

      <div className="grid gap-5 sm:grid-cols-2">
        <form.Field name="name">
          {(field) => (
            <TextField field={field} label="Full name" autoComplete="name" placeholder="Jane Doe" className="sm:col-span-2" />
          )}
        </form.Field>

        <form.Field name="email">
          {(field) => (
            <TextField field={field} label="Email" type="email" autoComplete="email" placeholder="you@university.edu" className="sm:col-span-2" />
          )}
        </form.Field>

        <form.Field name="password">
          {(field) => (
            <TextField field={field} label="Password" type="password" autoComplete="new-password" hint="8+ characters with upper, lower, number and symbol." />
          )}
        </form.Field>

        <form.Field name="confirmPassword">
          {(field) => (
            <TextField field={field} label="Confirm password" type="password" autoComplete="new-password" />
          )}
        </form.Field>

        <form.Field name="phone">
          {(field) => <TextField field={field} label="Phone (optional)" type="tel" autoComplete="tel" placeholder="01XXXXXXXXX" />}
        </form.Field>

        <form.Field name="dateOfBirth">
          {(field) => <TextField field={field} label="Date of birth (optional)" type="date" />}
        </form.Field>

        {catalogReady ? (
          <>
            <form.Field name="departmentId">
              {(field) => (
                <SelectField
                  field={field}
                  label="Department"
                  placeholder="Choose a department"
                  options={departments.data?.data.map((d) => ({ value: d.id, label: `${d.name} (${d.code})` })) ?? []}
                />
              )}
            </form.Field>

            <form.Field name="admissionSemesterId">
              {(field) => (
                <SelectField
                  field={field}
                  label="Admission semester"
                  placeholder="Choose a semester"
                  options={semesters.data?.data.map((s) => ({ value: s.id, label: `${s.code} ${s.year}` })) ?? []}
                />
              )}
            </form.Field>
          </>
        ) : (
          <div className="space-y-5 sm:col-span-2" aria-live="polite">
            <p className="text-muted-foreground text-sm">
              {departments.isError || semesters.isError
                ? "We couldn't load departments and semesters. Refresh the page to try again."
                : "Loading departments and semesters…"}
            </p>
            <Skeleton className="h-11 w-full" />
            <Skeleton className="h-11 w-full" />
          </div>
        )}
      </div>

      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <Button
            type="submit"
            size="lg"
            disabled={!canSubmit || isSubmitting || register.isPending || !catalogReady}
            className="bg-brand-gradient h-11 w-full text-white hover:opacity-90"
          >
            {isSubmitting || register.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                Creating account…
              </>
            ) : (
              "Create account"
            )}
          </Button>
        )}
      </form.Subscribe>

      <p className="text-muted-foreground text-center text-sm">
        Already registered?{" "}
        <Link href="/login" className="text-primary font-medium underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </form>
  );
}

type AnyField = {
  name: string;
  state: { value: string; meta: { isTouched: boolean; errors: unknown[] } };
  handleBlur: () => void;
  handleChange: (value: string) => void;
};

function TextField({
  field,
  label,
  hint,
  className,
  ...inputProps
}: {
  field: AnyField;
  label: string;
  hint?: string;
  className?: string;
} & Omit<React.ComponentProps<typeof Input>, "name" | "value" | "onChange" | "onBlur">) {
  const errors = field.state.meta.isTouched ? field.state.meta.errors : [];
  const errorId = `${field.name}-error`;
  const hintId = `${field.name}-hint`;
  const describedBy = [errors.length ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label htmlFor={field.name}>{label}</Label>
      <Input
        id={field.name}
        name={field.name}
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        aria-invalid={errors.length > 0}
        aria-describedby={describedBy}
        className="h-11"
        {...inputProps}
      />
      {hint ? (
        <p id={hintId} className="text-muted-foreground text-xs">
          {hint}
        </p>
      ) : null}
      <FieldMessage id={errorId} errors={errors} />
    </div>
  );
}

function SelectField({
  field,
  label,
  placeholder,
  options,
}: {
  field: AnyField;
  label: string;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  const errors = field.state.meta.isTouched ? field.state.meta.errors : [];
  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>{label}</Label>
      <Select value={field.state.value} onValueChange={(value) => field.handleChange(value)}>
        <SelectTrigger id={field.name} aria-invalid={errors.length > 0} className="h-11 w-full" onBlur={field.handleBlur}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <FieldMessage id={`${field.name}-error`} errors={errors} />
    </div>
  );
}
