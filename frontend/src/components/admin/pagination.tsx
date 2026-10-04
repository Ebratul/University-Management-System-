"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PAGE_SIZES, type PageSize } from "@/hooks/use-list-state";
import type { PaginationMeta } from "@/types/api";

export function Pagination({
  meta,
  onPageChange,
  onLimitChange,
  limit,
}: {
  meta: PaginationMeta | undefined;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: PageSize) => void;
  limit: PageSize;
}) {
  const page = meta?.page ?? 1;
  const totalPages = Math.max(1, meta?.totalPages ?? 1);
  const total = meta?.total ?? 0;

  return (
    <nav aria-label="Pagination" className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground text-sm" aria-live="polite">
        {total === 0 ? "No results" : `Page ${page} of ${totalPages} · ${total} total`}
      </p>

      <div className="flex items-center gap-2">
        <label className="text-muted-foreground flex items-center gap-2 text-sm">
          Rows
          <select
            value={limit}
            onChange={(event) => onLimitChange(Number(event.target.value) as PageSize)}
            className="border-input bg-background h-8 rounded-md border px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>
        <Button variant="outline" size="icon-sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)} aria-label="Previous page">
          <ChevronLeft className="size-4" aria-hidden="true" />
        </Button>
        <Button variant="outline" size="icon-sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)} aria-label="Next page">
          <ChevronRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
