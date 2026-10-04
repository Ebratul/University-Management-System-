import { TriangleAlert } from "lucide-react";

/** Form-level error box for failures that are not tied to one field. */
export function FormAlert({ message, details }: { message: string; details?: string[] }) {
  return (
    <div role="alert" className="bg-destructive/10 text-destructive flex gap-2 rounded-lg p-3 text-sm">
      <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <div className="space-y-1">
        <p className="font-medium">{message}</p>
        {details && details.length > 0 ? (
          <ul className="list-disc space-y-0.5 pl-4 text-xs">
            {details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
