"use client";

import { ScrollText } from "lucide-react";

import { DataTable, type Column } from "@/components/admin/data-table";
import { Pagination } from "@/components/admin/pagination";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useApiQuery } from "@/hooks/use-api-query";
import { useListState } from "@/hooks/use-list-state";
import { useUrlParam } from "@/hooks/use-url-param";
import { apiListRequest } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { AuditLog } from "@/types/entities";

const FILTER_KEYS = ["action", "entityType", "from", "to"];
const RESET_PAGE = ["page"];

/** Read-only history of every mutating action. Filters are kept in the URL. */
export function AuditLogViewer() {
  const list = useListState(FILTER_KEYS);

  const logs = useApiQuery({
    queryKey: queryKeys.auditLogs.list(list.query),
    queryFn: () => apiListRequest<AuditLog>("/admin/audit-logs", list.query),
    keepPreviousData: true,
  });

  const columns: Column<AuditLog>[] = [
    { id: "when", header: "When", cell: (log) => <time dateTime={log.createdAt} className="text-muted-foreground text-xs whitespace-nowrap">{new Date(log.createdAt).toLocaleString("en-GB")}</time> },
    {
      id: "actor",
      header: "Actor",
      className: "hidden md:table-cell",
      cell: (log) => (
        <div className="min-w-0">
          <p className="truncate text-sm">{log.performedByEmail ?? "System"}</p>
          {log.performedByRole ? <p className="text-muted-foreground text-xs">{log.performedByRole.toLowerCase()}</p> : null}
        </div>
      ),
    },
    { id: "action", header: "Action", cell: (log) => <Badge variant="outline" className="font-mono text-[11px]">{log.action}</Badge> },
    { id: "entity", header: "Entity", className: "hidden sm:table-cell", cell: (log) => <span className="text-sm">{log.entityType}</span> },
    { id: "description", header: "Details", className: "hidden lg:table-cell", cell: (log) => <span className="text-muted-foreground line-clamp-1 text-sm">{log.description ?? "—"}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Oversight" title="Audit log" description="Who changed what, and when. Entries are written by the API and cannot be edited." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FilterField paramKey="action" label="Action" placeholder="e.g. PAYMENT_COMPLETED" />
        <FilterField paramKey="entityType" label="Entity type" placeholder="e.g. Payment" />
        <FilterField paramKey="from" label="From" type="date" />
        <FilterField paramKey="to" label="To" type="date" />
      </div>

      <DataTable
        caption="Audit log entries"
        columns={columns}
        rows={logs.data?.data}
        isLoading={logs.isPending}
        isError={logs.isError}
        errorMessage={logs.error?.message}
        onRetry={() => void logs.refetch()}
        emptyIcon={ScrollText}
        emptyTitle="No entries match"
        emptyDescription="Clear a filter to see more of the history."
      />

      <Pagination meta={logs.data?.meta} limit={list.limit} onPageChange={(page) => list.update({ page })} onLimitChange={(limit) => list.update({ limit, page: 1 })} />
    </div>
  );
}

/** A filter input bound to one URL parameter. Typing is debounced, so the URL updates once the user pauses. */
function FilterField({ paramKey, label, placeholder, type = "text" }: { paramKey: string; label: string; placeholder?: string; type?: string }) {
  const [value, setValue] = useUrlParam(paramKey, 300, RESET_PAGE);
  return (
    <div className="space-y-1.5">
      <Label htmlFor={`audit-${paramKey}`} className="text-xs">{label}</Label>
      <Input id={`audit-${paramKey}`} type={type} placeholder={placeholder} value={value} onChange={(event) => setValue(event.target.value)} className="h-10" />
    </div>
  );
}
