"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard, ExternalLink, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/admin/data-table";
import { FormDialog } from "@/components/admin/form-dialog";
import { FormAlert } from "@/components/forms/form-alert";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { paymentBadge, money } from "@/features/payments/payments-manager";
import { useApiQuery } from "@/hooks/use-api-query";
import { useSemesterOptions } from "@/hooks/use-options";
import { apiListRequest, apiRequest } from "@/lib/api/client";
import { toApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";
import { formatDate } from "@/lib/format";
import type { Payment } from "@/types/entities";

type InitiateResult = { payment: Payment; bkashURL: string };

export function MyPayments() {
  const [paying, setPaying] = useState(false);
  const payments = useApiQuery({
    queryKey: queryKeys.payments.list({ mine: true }),
    queryFn: () => apiListRequest<Payment>("/payments", { limit: 100, sortBy: "createdAt", sortOrder: "desc" }),
    // A payment that is still pending is re-checked until the gateway confirms it.
    refetchInterval: (query) => (query.state.data?.data.some((p) => p.status === "PENDING") ? 5000 : false),
  });

  const columns: Column<Payment>[] = [
    {
      id: "semester",
      header: "For",
      cell: (p) => (
        <div>
          <span className="font-medium">{p.semester.code} {p.semester.year}</span>
          {p.registrationInvoice ? (
            <Link href={`/student/registration/${p.registrationInvoice.registrationId}`} className="text-primary block text-xs underline-offset-4 hover:underline">
              Course registration · {p.registrationInvoice.invoiceNo}
            </Link>
          ) : (
            <span className="text-muted-foreground block text-xs">Semester tuition</span>
          )}
        </div>
      ),
    },
    { id: "amount", header: "Amount", cell: (p) => <span className="tabular-nums">{money.format(p.amount)}</span> },
    { id: "status", header: "Status", cell: (p) => paymentBadge(p.status) },
    { id: "date", header: "Date", className: "hidden sm:table-cell", cell: (p) => <span className="text-muted-foreground text-sm">{formatDate(p.createdAt)}</span> },
    { id: "trx", header: "Transaction", className: "hidden lg:table-cell", cell: (p) => <span className="text-muted-foreground font-mono text-xs">{p.transactionId ?? "—"}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Fees"
        title="Payments"
        description="Pay a semester's tuition through bKash. The status here is the one the payment gateway confirmed."
        actions={
          <Button onClick={() => setPaying(true)} className="bg-brand-gradient text-white hover:opacity-90">
            <CreditCard className="size-4" aria-hidden="true" />
            Pay semester fee
          </Button>
        }
      />

      <DataTable
        caption="My payments"
        columns={columns}
        rows={payments.data?.data}
        isLoading={payments.isPending}
        isError={payments.isError}
        errorMessage={payments.error?.message}
        onRetry={() => void payments.refetch()}
        emptyIcon={CreditCard}
        emptyTitle="No payments yet"
        emptyDescription="When you pay a semester fee it appears here."
      />

      <FormDialog open={paying} onOpenChange={setPaying} title="Pay semester fee" description="You will be taken to bKash to complete payment. The amount is set by the university.">
        {paying ? <PayForm onDone={() => setPaying(false)} /> : null}
      </FormDialog>
    </div>
  );
}

function PayForm({ onDone }: { onDone: () => void }) {
  const queryClient = useQueryClient();
  const semesters = useSemesterOptions();
  const [semesterId, setSemesterId] = useState("");
  const [error, setError] = useState<string | null>(null);

  const payable = semesters.semesters.filter((s) => s.feeAmount > 0);
  const chosen = payable.find((s) => s.id === semesterId);

  const initiate = useMutation<InitiateResult, Error, string>({
    mutationFn: (id) => apiRequest<InitiateResult>("/payments/initiate", { method: "POST", body: { semesterId: id } }),
    onSuccess: (result) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.payments.all });
      toast.success("Opening bKash…");
      // Leave the app for the payment gateway. The gateway returns to /student/payments/result.
      window.location.assign(result.bkashURL);
    },
    onError: (err) => {
      setError(toApiError(err).message);
    },
  });

  return (
    <div className="space-y-5">
      {error ? <FormAlert message={error} /> : null}
      <div className="space-y-2">
        <Label htmlFor="pay-semester">Semester</Label>
        <Select value={semesterId} onValueChange={setSemesterId} disabled={semesters.isLoading || payable.length === 0}>
          <SelectTrigger id="pay-semester" className="h-10 w-full">
            <SelectValue placeholder={payable.length === 0 ? "No fees are set yet" : "Choose a semester"} />
          </SelectTrigger>
          <SelectContent>
            {payable.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.code} {s.year}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="bg-muted/50 flex items-center justify-between rounded-lg p-4">
        <span className="text-muted-foreground text-sm">Amount due</span>
        <span className="text-lg font-semibold tabular-nums">{chosen ? money.format(chosen.feeAmount) : "—"}</span>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button
          type="button"
          disabled={!semesterId || initiate.isPending}
          onClick={() => {
            setError(null);
            initiate.mutate(semesterId);
          }}
          className="bg-brand-gradient text-white hover:opacity-90"
        >
          {initiate.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <ExternalLink className="size-4" aria-hidden="true" />}
          Continue to bKash
        </Button>
      </div>
    </div>
  );
}
