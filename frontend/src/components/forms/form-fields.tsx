"use client";

import type { AnyFieldApi } from "@tanstack/react-form";
import type { ComponentProps } from "react";

import { FieldMessage } from "@/components/forms/field-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/**
 * Field components bound to a TanStack Form field. Errors show once the field
 * has been touched or the form has been submitted, and the message is linked
 * to the input for screen readers.
 */
type FieldProps = { field: AnyFieldApi };

function useFieldErrors(field: AnyFieldApi) {
  const errors = field.state.meta.isTouched ? field.state.meta.errors : [];
  const errorId = `${field.name}-error`;
  return { errors, errorId, invalid: errors.length > 0, describedBy: errors.length ? errorId : undefined };
}

export function TextInputField({
  field,
  label,
  hint,
  className,
  ...inputProps
}: FieldProps & { label: string; hint?: string; className?: string } & Omit<ComponentProps<typeof Input>, "name" | "value" | "onChange" | "onBlur">) {
  const { errors, errorId, invalid, describedBy } = useFieldErrors(field);
  const hintId = `${field.name}-hint`;

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label htmlFor={field.name}>{label}</Label>
      <Input
        id={field.name}
        name={field.name}
        value={field.state.value ?? ""}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        aria-invalid={invalid}
        aria-describedby={[describedBy, hint ? hintId : null].filter(Boolean).join(" ") || undefined}
        className="h-10"
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

export function TextareaField({
  field,
  label,
  rows = 5,
  className,
}: FieldProps & { label: string; rows?: number; className?: string }) {
  const { errors, errorId, invalid, describedBy } = useFieldErrors(field);

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label htmlFor={field.name}>{label}</Label>
      <textarea
        id={field.name}
        name={field.name}
        rows={rows}
        value={field.state.value ?? ""}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        aria-invalid={invalid}
        aria-describedby={describedBy}
        className="border-input bg-background placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive min-h-24 w-full rounded-md border px-3 py-2 text-sm outline-none"
      />
      <FieldMessage id={errorId} errors={errors} />
    </div>
  );
}

export function SelectInputField({
  field,
  label,
  placeholder,
  options,
  disabled,
  className,
  hint,
}: FieldProps & {
  label: string;
  placeholder: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  className?: string;
  hint?: string;
}) {
  const { errors, errorId, invalid } = useFieldErrors(field);

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label htmlFor={field.name}>{label}</Label>
      <Select value={field.state.value ?? ""} onValueChange={(value) => field.handleChange(value)} disabled={disabled}>
        <SelectTrigger id={field.name} aria-invalid={invalid} className="h-10 w-full" onBlur={field.handleBlur}>
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
      {hint ? <p className="text-muted-foreground text-xs">{hint}</p> : null}
      <FieldMessage id={errorId} errors={errors} />
    </div>
  );
}
