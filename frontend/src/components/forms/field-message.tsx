import { AlertCircle } from "lucide-react";

/** Turns a TanStack Form or Zod error value into text. */
export function errorText(error: unknown): string | null {
  if (!error) return null;
  if (typeof error === "string") return error;
  if (typeof error === "object" && "message" in error && typeof error.message === "string") {
    return error.message;
  }
  return null;
}

export function FieldMessage({ id, errors }: { id: string; errors: unknown[] }) {
  const message = errors.map(errorText).find(Boolean);
  if (!message) return null;

  return (
    <p id={id} role="alert" className="text-destructive flex items-center gap-1.5 text-sm">
      <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
      {message}
    </p>
  );
}
