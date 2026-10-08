"use client";

import { FieldMessage } from "@/components/forms/field-message";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** One field for the 6-digit emailed code: numeric keypad, one-time-code autofill, digits only. */
export function CodeInput({
  id = "code",
  value,
  onChange,
  onBlur,
  errors,
  autoFocus,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  errors: unknown[];
  autoFocus?: boolean;
}) {
  const errorId = `${id}-error`;
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>6-digit code</Label>
      <Input
        id={id}
        name={id}
        value={value}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="[0-9]*"
        maxLength={6}
        placeholder="000000"
        autoFocus={autoFocus}
        onBlur={onBlur}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
        aria-invalid={errors.length > 0}
        aria-describedby={errors.length ? errorId : undefined}
        className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
      />
      <FieldMessage id={errorId} errors={errors} />
    </div>
  );
}
