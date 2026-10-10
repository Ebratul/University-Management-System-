"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { Camera, Loader2, X } from "lucide-react";

import { FieldMessage } from "@/components/forms/field-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { authApi, catalogApi, offeringCatalogApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";
import { registerSchema, toRegisterPayload, type RegisterFormInput } from "@/lib/validations/auth";

const emptyValues: RegisterFormInput = {
  name: "",
  email: "",
  password: "",
  confirmPassword: "",
  registrationNumber: "",
  picture: null,
  phone: "",
  dateOfBirth: "",
  departmentId: "",
  semesterLevel: "",
};

const SEMESTER_LEVELS = ["1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"].map((label, index) => ({
  value: String(index + 1),
  label: `${label} Semester`,
}));

export function RegisterForm() {
  const router = useRouter();
  const [serverError, setServerError] = useState<string | null>(null);

  const departments = useApiQuery({
    queryKey: queryKeys.departments.list({ limit: 100, sortBy: "name", sortOrder: "asc" }),
    queryFn: catalogApi.departments,
  });

  const register = useApiMutation({
    mutationFn: (values: RegisterFormInput) => authApi.register(toRegisterPayload(values)),
    notifyError: false,
    successMessage: (result, values) =>
      result.emailSent
        ? `Welcome, ${values.name.trim().split(/\s+/)[0]}! We sent a 6-digit code to ${values.email.trim()}.`
        : "Account created, but we could not send the code. Use “Resend code” on the next screen.",
    onSuccess: (result, values) => {
      // Not signed in yet: the emailed code proves the address first.
      const email = encodeURIComponent(values.email.trim());
      router.replace(`/verify-email?email=${email}${result.emailSent ? "&sent=1" : ""}`);
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

  const catalogReady = departments.isSuccess;

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

        <form.Field name="registrationNumber">
          {(field) => (
            <TextField field={field} label="Registration number" autoComplete="off" placeholder="e.g. 2024-CSE-001" className="sm:col-span-2" hint="Your university registration number. It must be unique." />
          )}
        </form.Field>

        <form.Field name="picture">
          {(field) => <PictureField field={field} />}
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

            <form.Field name="semesterLevel">
              {(field) => (
                <SelectField field={field} label="Select Semester" placeholder="Choose your semester" options={SEMESTER_LEVELS} />
              )}
            </form.Field>

            <form.Subscribe
              selector={(state) =>
                [state.values.departmentId, state.values.semesterLevel] as const
              }
            >
              {([departmentId, semesterLevel]) => (
                <SemesterCourses departmentId={departmentId} semesterLevel={semesterLevel} />
              )}
            </form.Subscribe>
          </>
        ) : (
          <div className="space-y-5 sm:col-span-2" aria-live="polite">
            <p className="text-muted-foreground text-sm">
              {departments.isError
                ? "We couldn't load departments. Refresh the page to try again."
                : "Loading departments…"}
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

/** Courses already assigned (by an admin) to the chosen department and semester. Read-only. */
function SemesterCourses({
  departmentId,
  semesterLevel,
}: {
  departmentId: string;
  semesterLevel: string;
}) {
  const enabled = Boolean(departmentId && semesterLevel);
  const offerings = useApiQuery({
    queryKey: queryKeys.catalogOfferings.forSemester(departmentId, semesterLevel),
    queryFn: () =>
      offeringCatalogApi.forSemester({
        departmentId,
        semesterLevel: Number(semesterLevel),
      }),
    enabled,
  });

  if (!enabled) return null;

  // One course can be offered in several calendar semesters; list it once.
  const courses = [...new Map((offerings.data?.data ?? []).map((o) => [o.course.id, o.course])).values()];

  return (
    <div className="space-y-2 sm:col-span-2" aria-live="polite">
      <Label>Courses for this semester</Label>
      {offerings.isPending ? (
        <Skeleton className="h-11 w-full" />
      ) : offerings.isError ? (
        <p className="text-muted-foreground text-sm">We couldn&apos;t load the courses. They will be available after you sign in.</p>
      ) : courses.length === 0 ? (
        <p className="text-muted-foreground text-sm">No courses are assigned to this semester and department yet.</p>
      ) : (
        <ul className="divide-y rounded-lg border text-sm">
          {courses.map((course) => (
            <li key={course.id} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0 truncate">
                <span className="font-medium">{course.courseCode}</span> · {course.title}
              </span>
              <span className="text-muted-foreground shrink-0 text-xs">{course.credits} cr</span>
            </li>
          ))}
        </ul>
      )}
    </div>
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

type PictureFieldApi = {
  name: string;
  state: { value: File | null; meta: { isTouched: boolean; errors: unknown[] } };
  handleBlur: () => void;
  handleChange: (value: File | null) => void;
};

/** Required student picture with a live preview. It becomes the profile picture. */
function PictureField({ field }: { field: PictureFieldApi }) {
  const file = field.state.value;
  const errors = field.state.meta.isTouched ? field.state.meta.errors : [];
  const errorId = `${field.name}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const preview = useFilePreview(file);

  return (
    <div className="space-y-2 sm:col-span-2">
      <Label htmlFor={field.name}>Student picture</Label>
      <div className="flex items-center gap-4">
        <span
          className="bg-muted text-muted-foreground flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full border"
          aria-hidden="true"
        >
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="size-full object-cover" />
          ) : (
            <Camera className="size-7" />
          )}
        </span>
        <div className="min-w-0 space-y-2">
          <input
            ref={inputRef}
            id={field.name}
            name={field.name}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-invalid={errors.length > 0}
            aria-describedby={errors.length ? errorId : `${field.name}-hint`}
            onBlur={field.handleBlur}
            onChange={(event) => field.handleChange(event.target.files?.[0] ?? null)}
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
              {file ? "Change picture" : "Choose picture"}
            </Button>
            {file ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  field.handleChange(null);
                  if (inputRef.current) inputRef.current.value = "";
                }}
              >
                <X className="size-4" aria-hidden="true" />
                Remove
              </Button>
            ) : null}
          </div>
          <p id={`${field.name}-hint`} className="text-muted-foreground truncate text-xs">
            {file ? file.name : "JPG, PNG or WebP, up to 5 MB. This becomes your profile picture."}
          </p>
        </div>
      </div>
      <FieldMessage id={errorId} errors={errors} />
    </div>
  );
}

/** A data-URL preview of a File. State is set from the reader callback, never synchronously. */
function useFilePreview(file: File | null): string | null {
  const [loaded, setLoaded] = useState<{ file: File; url: string } | null>(null);
  useEffect(() => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLoaded({ file, url: String(reader.result) });
    reader.readAsDataURL(file);
    return () => {
      reader.onload = null;
      if (reader.readyState === FileReader.LOADING) reader.abort();
    };
  }, [file]);
  return file && loaded?.file === file ? loaded.url : null;
}
