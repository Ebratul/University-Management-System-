"use client";

import Link from "next/link";
import { ClipboardList } from "lucide-react";

import { DataTable, type Column } from "@/components/admin/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiListRequest } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { formatDate, formatPaisa } from "@/lib/format";
import type { Registration } from "@/types/entities";
import { InvoiceStatusBadge, RegistrationStatusBadge } from "./registration-status";

/** The student's registrations across all semesters. */
export function RegistrationHistory() {
  const query = { limit: 50 };
  const registrations = useApiQuery({
    queryKey: queryKeys.registrations.list({ mine: true, ...query }),
    queryFn: () => apiListRequest<Registration>("/registrations", query),
  });

  const columns: Column<Registration>[] = [
    {
      id: "registration",
      header: "Registration",
      cell: (r) => (
        <Link href={`/student/registration/${r.id}`} className="font-medium underline-offset-4 hover:underline">
          <span className="font-mono text-sm">{r.registrationNo}</span>
          <span className="text-muted-foreground block text-xs font-normal">{r.semester.code} {r.semester.year}</span>
        </Link>
      ),
    },
    { id: "date", header: "Registered", className: "hidden sm:table-cell", cell: (r) => <span className="text-muted-foreground text-sm">{formatDate(r.submittedAt)}</span> },
    { id: "credits", header: "Credits", className: "hidden md:table-cell", cell: (r) => <span className="tabular-nums">{r.totalCredits}</span> },
    { id: "fee", header: "Total fee", cell: (r) => <span className="tabular-nums">{r.invoice ? formatPaisa(r.invoice.totalAmount) : "—"}</span> },
    { id: "payment", header: "Payment", className: "hidden md:table-cell", cell: (r) => (r.invoice ? <InvoiceStatusBadge status={r.invoice.status} /> : "—") },
    { id: "status", header: "Status", cell: (r) => <RegistrationStatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Academics"
        title="My registrations"
        description="Every course registration you have made, with its invoice, payment and receipt."
        actions={<Button asChild className="bg-brand-gradient text-white hover:opacity-90"><Link href="/student/registration">Register courses</Link></Button>}
      />
      <DataTable
        caption="My registrations"
        columns={columns}
        rows={registrations.data?.data}
        isLoading={registrations.isPending}
        isError={registrations.isError}
        errorMessage={registrations.error?.message}
        onRetry={() => void registrations.refetch()}
        emptyIcon={ClipboardList}
        emptyTitle="No registrations yet"
        emptyDescription="When you register for courses they appear here."
        emptyAction={<Button asChild><Link href="/student/registration">Register courses</Link></Button>}
      />
    </div>
  );
}
