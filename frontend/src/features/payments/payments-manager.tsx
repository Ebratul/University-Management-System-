"use client";

import Link from "next/link";
import { CreditCard } from "lucide-react";

import { DataTable, type Column } from "@/components/admin/data-table";
import { Pagination } from "@/components/admin/pagination";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { useApiQuery } from "@/hooks/use-api-query";
import { useSemesterOptions } from "@/hooks/use-options";
import { useListState } from "@/hooks/use-list-state";
import { apiListRequest } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { formatDate } from "@/lib/format";
import type { Payment, PaymentStatus } from "@/types/entities";

const FILTER_KEYS = ["status", "semesterId"];
const statuses: PaymentStatus[] = ["PENDING", "PAID", "FAILED"];
export const money = new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", maximumFractionDigits: 0 });

export function paymentBadge(status: PaymentStatus) {
  const variant = status === "PAID" ? "default" : status === "FAILED" ? "destructive" : "secondary";
  return <Badge variant={variant}>{status.toLowerCase()}</Badge>;
}

export function PaymentsManager() {
  const list = useListState(FILTER_KEYS);
  const semesters = useSemesterOptions();

  const payments = useApiQuery({
    queryKey: queryKeys.payments.list(list.query),
    queryFn: () => apiListRequest<Payment>("/payments", list.query),
    keepPreviousData: true,
  });

  const columns: Column<Payment>[] = [
    {
      id: "student",
      header: "Student",
      cell: (p) => (
        <Link href={`/admin/students/${p.studentId}`} className="font-medium underline-offset-4 hover:underline">
          {p.student.name}
        </Link>
      ),
    },
    {
      id: "semester",
      header: "Semester",
      cell: (p) => (
        <div>
          <span>{p.semester.code} {p.semester.year}</span>
          <span className="text-muted-foreground block text-xs">{p.registrationInvoice ? `Course registration · ${p.registrationInvoice.invoiceNo}` : "Tuition"}</span>
        </div>
      ),
    },
    { id: "amount", header: "Amount", sortKey: "amount", cell: (p) => <span className="tabular-nums">{money.format(p.amount)}</span> },
    { id: "status", header: "Status", cell: (p) => paymentBadge(p.status) },
    { id: "date", header: "Date", className: "hidden md:table-cell", cell: (p) => <span className="text-muted-foreground">{formatDate(p.createdAt)}</span> },
    {
      id: "detail",
      header: "",
      cell: (p) => (
        <Link href={`/admin/payments/${p.id}`} className="text-primary text-sm font-medium underline-offset-4 hover:underline">
          View
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Finance" title="Payments" description="Tuition payments. Only the gateway callback can mark a payment as paid." />

      <div className="flex flex-wrap items-center gap-3">
        <select aria-label="Filter by status" value={list.filters.status ?? ""} onChange={(event) => list.update({ status: event.target.value })} className="border-input bg-background h-10 rounded-md border px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <option value="">All statuses</option>
          {statuses.map((status) => <option key={status} value={status}>{status.toLowerCase()}</option>)}
        </select>
        <select aria-label="Filter by semester" value={list.filters.semesterId ?? ""} onChange={(event) => list.update({ semesterId: event.target.value })} className="border-input bg-background h-10 max-w-64 rounded-md border px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <option value="">All semesters</option>
          {semesters.options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>

      <DataTable
        caption="Payments"
        columns={columns}
        rows={payments.data?.data}
        isLoading={payments.isPending}
        isError={payments.isError}
        errorMessage={payments.error?.message}
        onRetry={() => void payments.refetch()}
        sortBy={list.sortBy ?? "createdAt"}
        sortOrder={list.sortOrder ?? "desc"}
        onSort={(sortKey, order) => list.update({ sortBy: sortKey, sortOrder: order, page: 1 })}
        emptyIcon={CreditCard}
        emptyTitle="No payments match"
        emptyDescription="Payments appear once a student starts checkout."
      />

      <Pagination meta={payments.data?.meta} limit={list.limit} onPageChange={(page) => list.update({ page })} onLimitChange={(limit) => list.update({ limit, page: 1 })} />
    </div>
  );
}
