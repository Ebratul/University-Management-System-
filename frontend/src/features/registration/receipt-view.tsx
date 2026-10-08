"use client";

import Link from "next/link";
import { Download, Printer, Receipt } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/use-api-query";
import { registrationApi } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/query-keys";
import { formatDateTime, formatPaisa } from "@/lib/format";
import { FeeBreakdown } from "./fee-breakdown";

/** A printable registration receipt. Only exists once the registration is confirmed and paid. */
export function ReceiptView({ registrationId, backHref }: { registrationId: string; backHref: string }) {
  const receipt = useApiQuery({
    queryKey: queryKeys.registrations.receipt(registrationId),
    queryFn: () => registrationApi.receipt(registrationId),
  });

  if (receipt.isPending) return <Skeleton className="mx-auto h-[36rem] max-w-3xl rounded-xl" />;
  if (receipt.isError) {
    return (
      <EmptyState
        icon={Receipt}
        title="No receipt yet"
        description={receipt.error.message}
        action={<Button asChild variant="outline"><Link href={backHref}>Back to registration</Link></Button>}
      />
    );
  }
  const r = receipt.data;
  const inv = r.invoice;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <Button asChild variant="outline" size="sm"><Link href={backHref}>Back</Link></Button>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="size-4" aria-hidden="true" /> Print
          </Button>
          <Button asChild size="sm" className="bg-brand-gradient text-white hover:opacity-90">
            <a href={registrationApi.receiptPdfUrl(registrationId)} download>
              <Download className="size-4" aria-hidden="true" /> Download PDF
            </a>
          </Button>
        </div>
      </div>

      <article aria-label="Registration receipt" className="bg-card space-y-6 rounded-2xl border p-6 shadow-sm sm:p-10 print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="space-y-1 border-b pb-5 text-center">
          <h1 className="text-brand-indigo text-xl font-bold">{r.universityName}</h1>
          <p className="text-muted-foreground text-sm">Course Registration Receipt</p>
        </header>

        <dl className="grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
          <Row label="Student" value={r.student.name} />
          <Row label="Student ID" value={r.student.studentId} mono />
          <Row label="Registration number" value={r.student.registrationNumber} mono />
          <Row label="Department" value={r.student.department} />
          <Row label="Semester" value={r.semester} />
          <Row label="Registration ID" value={r.registration.registrationNo} mono />
          <Row label="Invoice" value={inv.invoiceNo} mono />
          {r.payment ? (
            <>
              <Row label="Payment ID" value={r.payment.transactionId ?? r.payment.id} mono />
              <Row label="Payment date" value={r.payment.paidAt ? formatDateTime(r.payment.paidAt) : "—"} />
              <Row label="Payment method" value={r.payment.paymentMethod} />
            </>
          ) : (
            <Row label="Payment" value="No fee was due" />
          )}
        </dl>

        <section aria-labelledby="receipt-courses">
          <h2 id="receipt-courses" className="mb-2 text-sm font-semibold">Registered courses</h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs uppercase">
                <th className="py-2 font-medium">Code</th>
                <th className="py-2 font-medium">Course</th>
                <th className="py-2 font-medium">Type</th>
                <th className="py-2 text-right font-medium">Credit</th>
              </tr>
            </thead>
            <tbody>
              {r.courses.map((c) => (
                <tr key={c.courseCode} className="border-b last:border-0">
                  <td className="py-2 font-mono text-xs">{c.courseCode}</td>
                  <td className="py-2">{c.courseTitle}</td>
                  <td className="py-2 capitalize">{c.courseType.toLowerCase()}</td>
                  <td className="py-2 text-right tabular-nums">{c.credits}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={3} className="py-2 text-right font-semibold">Total credits</td>
                <td className="py-2 text-right font-semibold tabular-nums">{inv.totalCredits}</td>
              </tr>
            </tfoot>
          </table>
        </section>

        <section aria-labelledby="receipt-fees" className="space-y-2">
          <h2 id="receipt-fees" className="text-sm font-semibold">Fee summary</h2>
          <FeeBreakdown fees={inv} />
        </section>

        <footer className="flex items-center justify-between border-t pt-4">
          <span className="text-success text-lg font-bold">Payment status: PAID</span>
          <span className="text-muted-foreground text-sm tabular-nums">{formatPaisa(inv.totalAmount)}</span>
        </footer>
        <p className="text-muted-foreground text-center text-xs">This is a computer-generated receipt. Keep the payment ID for your records.</p>
      </article>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-xs" : "font-medium"}>{value}</dd>
    </div>
  );
}
