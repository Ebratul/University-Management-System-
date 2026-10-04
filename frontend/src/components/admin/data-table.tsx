import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, RotateCw, TriangleAlert } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { PaginationMeta } from "@/types/api";

export type Column<T> = {
  id: string;
  header: string;
  /** Backend sort field. Columns without one are not sortable. */
  sortKey?: string;
  cell: (row: T) => ReactNode;
  /** e.g. "hidden md:table-cell" to drop the column on small screens. */
  className?: string;
};

type DataTableProps<T> = {
  caption: string;
  columns: Column<T>[];
  rows: T[] | undefined;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRetry?: () => void;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (sortKey: string, order: "asc" | "desc") => void;
  emptyIcon: LucideIcon;
  emptyTitle: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  /** Rendered as the last cell of each row (edit / delete buttons). */
  rowActions?: (row: T) => ReactNode;
  skeletonRows?: number;
  meta?: PaginationMeta;
};

/**
 * Generic table for server-paginated lists. Data, loading, error and empty
 * states are all handled here. Sorting is delegated to the server via onSort.
 */
export function DataTable<T extends { id: string }>({
  caption,
  columns,
  rows,
  isLoading,
  isError,
  errorMessage,
  onRetry,
  sortBy,
  sortOrder,
  onSort,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  emptyAction,
  rowActions,
  skeletonRows = 6,
}: DataTableProps<T>) {
  if (isError) {
    return (
      <div role="alert" className="bg-destructive/10 flex flex-col items-start gap-3 rounded-xl p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-destructive flex items-center gap-2 text-sm">
          <TriangleAlert className="size-4" aria-hidden="true" />
          {errorMessage ?? "This list could not be loaded."}
        </div>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCw className="size-4" aria-hidden="true" />
            Try again
          </Button>
        ) : null}
      </div>
    );
  }

  const hasRows = Boolean(rows && rows.length > 0);

  return (
    <div className="bg-card overflow-hidden rounded-xl border">
      <div className="overflow-x-auto">
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {columns.map((column) => (
                <TableHead key={column.id} className={cn("whitespace-nowrap", column.className)} aria-sort={ariaSort(column.sortKey, sortBy, sortOrder)}>
                  {column.sortKey && onSort ? (
                    <SortButton
                      label={column.header}
                      active={sortBy === column.sortKey}
                      order={sortBy === column.sortKey ? sortOrder : undefined}
                      onClick={() => onSort(column.sortKey!, sortBy === column.sortKey && sortOrder === "asc" ? "desc" : "asc")}
                    />
                  ) : (
                    column.header
                  )}
                </TableHead>
              ))}
              {rowActions ? <TableHead className="w-px text-right">Actions</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && !hasRows
              ? Array.from({ length: skeletonRows }, (_, index) => (
                  <TableRow key={`skeleton-${index}`} className="hover:bg-transparent">
                    {columns.map((column) => (
                      <TableCell key={column.id} className={column.className}>
                        <Skeleton className="h-4 w-full max-w-40" />
                      </TableCell>
                    ))}
                    {rowActions ? <TableCell><Skeleton className="ml-auto h-8 w-20" /></TableCell> : null}
                  </TableRow>
                ))
              : rows?.map((row) => (
                  <TableRow key={row.id}>
                    {columns.map((column) => (
                      <TableCell key={column.id} className={column.className}>
                        {column.cell(row)}
                      </TableCell>
                    ))}
                    {rowActions ? <TableCell className="text-right">{rowActions(row)}</TableCell> : null}
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </div>

      {!isLoading && !hasRows ? (
        <div className="p-4">
          <EmptyState icon={emptyIcon} title={emptyTitle} description={emptyDescription} action={emptyAction} />
        </div>
      ) : null}
    </div>
  );
}

function ariaSort(sortKey: string | undefined, sortBy: string | undefined, sortOrder: "asc" | "desc" | undefined) {
  if (!sortKey || sortBy !== sortKey) return undefined;
  return sortOrder === "asc" ? "ascending" : "descending";
}

function SortButton({ label, active, order, onClick }: { label: string; active: boolean; order?: "asc" | "desc"; onClick: () => void }) {
  const Icon = !active ? ArrowUpDown : order === "asc" ? ArrowUp : ArrowDown;
  return (
    <button
      type="button"
      onClick={onClick}
      className="hover:text-foreground -mx-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      {label}
      <Icon className={cn("size-3.5", active ? "text-foreground" : "text-muted-foreground/60")} aria-hidden="true" />
    </button>
  );
}
