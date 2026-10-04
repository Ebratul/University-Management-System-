"use client";

import Link from "next/link";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiRequest } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { formatDate } from "@/lib/format";
import type { Payment } from "@/types/entities";

import { money, paymentBadge } from "./payments-manager";

export function PaymentDetail({ id }: { id: string }) {
  const payment = useApiQuery({
    queryKey: queryKeys.payments.detail(id),
    queryFn: () => apiRequest<Payment>(`/payments/${id}`),
  });

  if (payment.isPending) return <Skeleton className="h-72 w-full rounded-xl" />;
  if (payment.isError) {
    return <div role="alert" className="bg-destructive/10 text-destructive rounded-xl p-5 text-sm">{payment.error.message}</div>;
  }

  const p = payment.data;
  const rows: [string, string][] = [
    ["Transaction ID", p.transactionId ?? "Not assigned"],
    ["Gateway payment ID", p.gatewayPaymentId],
    ["Method", p.paymentMethod],
    ["Paid on", p.paidAt ? formatDate(p.paidAt) : "—"],
    ["Failure reason", p.failureReason ?? "—"],
  ];

  return (
    <div className="space-y-8">
      <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
        <Link href="/admin/payments" className="hover:text-foreground underline-offset-4 hover:underline">Payments</Link>
      </nav>
      <PageHeader eyebrow={p.semester.code + " " + p.semester.year} title={money.format(p.amount)} description={`${p.student.name} (${p.student.studentId})`} actions={paymentBadge(p.status)} />

      <div className="grid gap-4 md:grid-cols-2">
        {rows.map(([label, value]) => (
          <Card key={label}>
            <CardHeader className="gap-1">
              <CardDescription>{label}</CardDescription>
              <CardTitle className="font-mono text-sm break-all">{value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
