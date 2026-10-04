import { Skeleton } from "@/components/ui/skeleton";

/** Shown while a manager's client bundle and its search params hydrate. */
export function ManagerSkeleton() {
  return (
    <div className="space-y-6" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="space-y-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-64" />
      </div>
      <Skeleton className="h-10 w-full max-w-md" />
      <Skeleton className="h-72 w-full rounded-xl" />
    </div>
  );
}
