"use client";

import Link from "next/link";
import { CheckCircle2, CircleAlert, Loader2 } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiRequest } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { formatDate } from "@/lib/format";
import type { Payment } from "@/types/entities";

import { money } from "@/features/payments/payments-manager";

/**
 * Shown after the bKash redirect. It never assumes success: the status comes
 * from the API, which only marks a payment PAID after verifying with bKash. The
 * page re-checks every 2 seconds while the payment is still PENDING.
 */
export function PaymentResult({ paymentId }: { paymentId: string | null }) {
  const payment = useApiQuery({
    queryKey: queryKeys.payments.detail(paymentId ?? "none"),
    queryFn: () => apiRequest<Payment>(`/payments/${paymentId}`),
    enabled: Boolean(paymentId),
    staleTime: 0,
  });

  if (!paymentId) return <Notice tone="error" title="No payment selected" text="Start a payment from the Payments page." />;
  if (payment.isPending) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (payment.isError) return <Notice tone="error" title="We could not load this payment" text={payment.error.message} />;

  const p = payment.data;

  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Fees" title="Payment result" />

      {p.status === "PENDING" ? (
        <Notice tone="pending" title="Confirming with bKash" text="This usually takes a few seconds. You can leave this page open; it updates by itself." />
      ) : p.status === "PAID" ? (
        <Notice tone="success" title="Payment received" text={`${money.format(p.amount)} for ${p.semester.code} ${p.semester.year} was confirmed${p.paidAt ? ` on ${formatDate(p.paidAt)}` : ""}.`} />
      ) : (
        <Notice tone="error" title="Payment did not go through" text={p.failureReason ? `The gateway reported: ${p.failureReason}.` : "No money was taken. You can try again from the Payments page."} />
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
          <CardDescription>Keep the transaction ID for your records.</CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Row label="Semester" value={`${p.semester.code} ${p.semester.year}`} />
            <Row label="Amount" value={money.format(p.amount)} />
            <Row label="Status" value={p.status.toLowerCase()} />
            <Row label="Transaction ID" value={p.transactionId ?? "Not assigned"} mono />
          </dl>
        </CardContent>
      </Card>

      <Button asChild variant="outline">
        <Link href="/student/payments">Back to payments</Link>
      </Button>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={mono ? "font-mono break-all" : "font-medium capitalize"}>{value}</dd>
    </div>
  );
}

function Notice({ tone, title, text }: { tone: "success" | "pending" | "error"; title: string; text: string }) {
  const styles = {
    success: { box: "border-success/40 bg-success/10", icon: <CheckCircle2 className="text-success size-6" aria-hidden="true" /> },
    pending: { box: "border-info/40 bg-info/10", icon: <Loader2 className="text-info size-6 animate-spin" aria-hidden="true" /> },
    error: { box: "border-destructive/40 bg-destructive/10", icon: <CircleAlert className="text-destructive size-6" aria-hidden="true" /> },
  }[tone];

  return (
    <div role={tone === "error" ? "alert" : "status"} aria-live="polite" className={`flex gap-4 rounded-xl border p-5 ${styles.box}`}>
      <span className="mt-0.5 shrink-0">{styles.icon}</span>
      <div className="space-y-1">
        <h2 className="font-semibold">{title}</h2>
        <p className="text-muted-foreground text-sm text-pretty">{text}</p>
      </div>
    </div>
  );
}
