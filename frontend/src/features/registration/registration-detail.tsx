"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Ban, Check, CircleAlert, Clock, CreditCard, Loader2, Receipt, RefreshCw } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { SectionCard } from "@/components/shared/section-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { registrationApi } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/query-keys";
import { formatDateTime, formatPaisa } from "@/lib/format";
import { ordinal } from "@/lib/validations/admin";
import { cn } from "@/lib/utils";
import type { Registration } from "@/types/entities";
import { FeeBreakdown } from "./fee-breakdown";
import { InvoiceStatusBadge, RegistrationStatusBadge } from "./registration-status";

const PAYMENT_BADGE: Record<string, string> = {
  PAID: "bg-success/15 text-success",
  PENDING: "bg-brand-sky/15 text-brand-sky",
  FAILED: "bg-destructive/10 text-destructive",
};

/**
 * One registration: its courses, invoice, payments, and what the viewer may do
 * next. Used by the student (pay, retry, cancel, receipt) and by an admin
 * (inspect, cancel or reject). The server decides what is allowed; the buttons
 * here only reflect the `canPay` / `canCancel` flags it sends.
 */
export function RegistrationDetail({
  registrationId,
  viewer,
  returnedFromGateway = false,
}: {
  registrationId: string;
  viewer: "student" | "admin";
  /** True when the student has just come back from bKash. */
  returnedFromGateway?: boolean;
}) {
  const queryClient = useQueryClient();
  const [paying, setPaying] = useState(false);
  const [closing, setClosing] = useState<"cancel" | "reject" | null>(null);
  const [reason, setReason] = useState("");

  const query = useApiQuery({
    queryKey: queryKeys.registrations.detail(registrationId),
    queryFn: () => registrationApi.get(registrationId),
    // While bKash is still confirming, keep checking.
    refetchInterval: (q) => (q.state.data?.paymentInProgress ? 4_000 : false),
  });
  const reg = query.data;

  const invalidate = [queryKeys.registrations.all];
  const pay = useApiMutation({
    mutationFn: () => registrationApi.pay(registrationId),
    successMessage: "Opening bKash…",
    invalidate,
    onSuccess: (result) => {
      // Leave for the payment gateway; it sends the payer back to this page.
      window.location.assign(result.bkashURL);
    },
  });
  const refresh = useApiMutation({
    mutationFn: () => registrationApi.refreshPayment(registrationId),
    invalidate,
    successMessage: "Payment status checked.",
  });
  const close = useApiMutation({
    mutationFn: (kind: "cancel" | "reject") =>
      registrationApi.cancel(registrationId, { reason: reason.trim() || undefined, reject: kind === "reject" }),
    successMessage: (_data, kind) => (kind === "reject" ? "Registration rejected." : "Registration cancelled. Its seats are free again."),
    invalidate,
    onSuccess: () => {
      setClosing(null);
      setReason("");
    },
  });

  // If bKash's return never reached the server, ask the gateway once, after a short wait.
  const autoRefreshed = useRef(false);
  const inProgress = reg?.paymentInProgress ?? false;
  useEffect(() => {
    if (viewer !== "student" || !inProgress || autoRefreshed.current) return;
    const timer = window.setTimeout(() => {
      autoRefreshed.current = true;
      void registrationApi.refreshPayment(registrationId).then(() => queryClient.invalidateQueries({ queryKey: queryKeys.registrations.all }));
    }, returnedFromGateway ? 6_000 : 20_000);
    return () => window.clearTimeout(timer);
  }, [viewer, inProgress, returnedFromGateway, registrationId, queryClient]);

  if (query.isPending) return <DetailSkeleton />;
  if (query.isError || !reg) {
    return (
      <EmptyState
        icon={Receipt}
        title="This registration is not available"
        description={query.error?.message ?? "It may not exist, or it belongs to someone else."}
        action={
          <Button asChild variant="outline">
            <Link href={viewer === "admin" ? "/admin/registration" : "/student/registrations"}>Back</Link>
          </Button>
        }
      />
    );
  }

  const invoice = reg.invoice;
  const latestPayment = invoice?.payments[0];

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
        <Link href={viewer === "admin" ? "/admin/registration" : "/student/registrations"} className="hover:text-foreground underline-offset-4 hover:underline">
          {viewer === "admin" ? "Course registration" : "My registrations"}
        </Link>
      </nav>

      <PageHeader
        eyebrow={`${reg.semester.code} ${reg.semester.year}${reg.isLate ? " · late registration" : ""}`}
        title={reg.registrationNo}
        description={`Submitted ${formatDateTime(reg.submittedAt)} · ${reg.totalCredits} credits`}
        actions={
          <>
            <RegistrationStatusBadge status={reg.status} className="h-8 px-3 text-sm" />
            {reg.status === "CONFIRMED" ? (
              <Button asChild className="bg-brand-gradient text-white hover:opacity-90">
                <Link href={viewer === "admin" ? `/admin/registration/${reg.id}/receipt` : `/student/registration/${reg.id}/receipt`}>
                  <Receipt className="size-4" aria-hidden="true" /> Receipt
                </Link>
              </Button>
            ) : null}
          </>
        }
      />

      <Stepper reg={reg} />
      <OutcomeBanner reg={reg} highlight={returnedFromGateway || viewer === "student"} />

      {viewer === "admin" ? (
        <SectionCard title="Student">
          <div className="flex flex-wrap items-center gap-4">
            <PersonAvatar name={reg.student.name} imageUrl={reg.student.user.imageUrl} className="size-14" />
            <div className="min-w-0">
              <p className="font-semibold">{reg.student.name}</p>
              <p className="text-muted-foreground font-mono text-xs">{reg.student.registrationNumber} · {reg.student.studentId}</p>
              <p className="text-muted-foreground text-sm">{reg.student.department.name} · {ordinal(reg.student.currentSemesterLevel)} semester</p>
            </div>
            <Button asChild variant="outline" size="sm" className="ml-auto">
              <Link href={`/admin/students/${reg.student.id}`}>Open student</Link>
            </Button>
          </div>
        </SectionCard>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <SectionCard title="Registered courses" description={`${reg.items.length} course${reg.items.length === 1 ? "" : "s"} · ${reg.totalCredits} credits`}>
          <div className="overflow-x-auto">
            <Table>
              <caption className="sr-only">Courses in this registration</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Course</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                  <TableHead className="text-right">Fee</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reg.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <p className="font-medium">{item.courseTitle}</p>
                      <p className="text-muted-foreground text-xs">
                        <span className="font-mono">{item.courseCode}</span> · {item.courseOffering.faculty.name}
                      </p>
                    </TableCell>
                    <TableCell className="capitalize">{item.courseType.toLowerCase()}</TableCell>
                    <TableCell className="text-right tabular-nums">{item.credits}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatPaisa(item.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>

        {invoice ? (
          <SectionCard title="Invoice" action={<InvoiceStatusBadge status={invoice.status} />}>
            <div className="space-y-5">
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Meta label="Invoice no." value={invoice.invoiceNo} mono />
                <Meta label="Created" value={formatDateTime(invoice.createdAt)} />
                <Meta label={invoice.status === "PAID" ? "Paid" : "Pay before"} value={formatDateTime(invoice.paidAt ?? invoice.expiresAt)} />
                <Meta label="Total credits" value={String(invoice.totalCredits)} />
              </dl>
              <FeeBreakdown fees={invoice} />
              {viewer === "student" ? (
                <div className="space-y-2">
                  {reg.canPay ? (
                    <Button className="bg-brand-gradient h-11 w-full text-white hover:opacity-90" onClick={() => setPaying(true)} disabled={pay.isPending}>
                      {pay.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <CreditCard className="size-4" aria-hidden="true" />}
                      {reg.paymentInProgress ? "Continue payment" : invoice.status === "FAILED" ? "Retry payment" : "Pay now"}
                    </Button>
                  ) : null}
                  {reg.paymentInProgress ? (
                    <Button variant="outline" className="w-full" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
                      {refresh.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="size-4" aria-hidden="true" />}
                      Check payment status
                    </Button>
                  ) : null}
                  {reg.canCancel ? (
                    <Button variant="ghost" className="text-destructive hover:text-destructive w-full" onClick={() => setClosing("cancel")}>
                      <Ban className="size-4" aria-hidden="true" /> Cancel registration
                    </Button>
                  ) : null}
                </div>
              ) : (
                reg.canCancel && (
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setClosing("cancel")}>Cancel</Button>
                    <Button variant="outline" className="text-destructive hover:text-destructive flex-1" onClick={() => setClosing("reject")}>Reject</Button>
                  </div>
                )
              )}
            </div>
          </SectionCard>
        ) : null}
      </div>

      {invoice && invoice.payments.length > 0 ? (
        <SectionCard title="Payment attempts" description={latestPayment?.status === "PAID" ? "Keep the transaction ID for your records." : undefined}>
          <div className="overflow-x-auto">
            <Table>
              <caption className="sr-only">Payment attempts for this invoice</caption>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Transaction ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoice.payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDateTime(p.paidAt ?? p.createdAt)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("border-transparent capitalize", PAYMENT_BADGE[p.status])}>{p.status.toLowerCase()}</Badge>
                      {p.failureReason ? <p className="text-muted-foreground mt-1 max-w-xs text-xs">{p.failureReason}</p> : null}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatPaisa(Math.round(p.amount * 100))}</TableCell>
                    <TableCell className="font-mono text-xs">{p.transactionId ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      ) : null}

      {reg.cancelReason ? <p className="text-muted-foreground text-sm">Reason: {reg.cancelReason}</p> : null}

      <AlertDialog open={paying} onOpenChange={setPaying}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Pay with bKash?</AlertDialogTitle>
            <AlertDialogDescription>
              You will pay <strong>{invoice ? formatPaisa(invoice.totalAmount) : ""}</strong> for registration {reg.registrationNo}. You are sent to bKash to approve it, then returned here. Your registration is confirmed only after bKash confirms the payment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not now</AlertDialogCancel>
            <AlertDialogAction
              disabled={pay.isPending}
              onClick={(event) => {
                event.preventDefault();
                pay.mutate(undefined, { onSettled: () => setPaying(false) });
              }}
            >
              {pay.isPending ? "Opening bKash…" : "Continue to bKash"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={closing !== null} onOpenChange={(open) => !open && setClosing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{closing === "reject" ? "Reject this registration?" : "Cancel this registration?"}</AlertDialogTitle>
            <AlertDialogDescription>
              The invoice is cancelled and the seats are given back. {viewer === "student" ? "You can register again while registration is open." : "The student can register again."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label htmlFor="close-reason" className="text-sm font-medium">Reason (optional)</label>
            <textarea
              id="close-reason"
              rows={2}
              maxLength={300}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="border-input bg-background focus-visible:ring-ring/50 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-3"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={close.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (closing) close.mutate(closing);
              }}
            >
              {close.isPending ? "Working…" : closing === "reject" ? "Reject registration" : "Cancel registration"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={cn("truncate", mono && "font-mono text-xs")}>{value}</dd>
    </div>
  );
}

/** Submitted -> Payment -> Confirmed, with the current step highlighted. */
function Stepper({ reg }: { reg: Registration }) {
  const closed = ["CANCELLED", "REJECTED", "EXPIRED"].includes(reg.status);
  const paid = reg.invoice?.status === "PAID";
  const confirmed = reg.status === "CONFIRMED";
  const steps = [
    { label: "Submitted", state: "done" as const },
    { label: reg.paymentRequired ? "Payment" : "No fee due", state: closed ? ("stopped" as const) : paid ? ("done" as const) : ("current" as const) },
    { label: "Confirmed", state: confirmed ? ("done" as const) : closed ? ("stopped" as const) : ("todo" as const) },
  ];
  return (
    <ol className="bg-card flex items-center gap-2 rounded-xl border p-4 text-sm" aria-label="Registration progress">
      {steps.map((step, i) => (
        <li key={step.label} className="flex flex-1 items-center gap-2 last:flex-none">
          <span
            aria-hidden="true"
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
              step.state === "done" && "border-success bg-success text-white",
              step.state === "current" && "border-primary text-primary ring-primary/30 ring-2",
              step.state === "stopped" && "border-destructive/50 text-destructive",
              step.state === "todo" && "text-muted-foreground",
            )}
          >
            {step.state === "done" ? <Check className="size-4" /> : i + 1}
          </span>
          <span className={cn("truncate", step.state === "todo" && "text-muted-foreground", step.state === "current" && "font-medium")}>{step.label}</span>
          {i < steps.length - 1 ? <span aria-hidden="true" className="bg-border mx-1 hidden h-px flex-1 sm:block" /> : null}
        </li>
      ))}
    </ol>
  );
}

/** The plain-language result of the latest payment, shown above everything else. */
function OutcomeBanner({ reg, highlight }: { reg: Registration; highlight: boolean }) {
  const invoice = reg.invoice;
  const payment = invoice?.payments[0];
  if (!invoice) return null;

  if (reg.status === "CONFIRMED") {
    return (
      <Banner tone="success" icon={<Check className="size-5" aria-hidden="true" />} title={invoice.totalAmount > 0 ? "Payment successful" : "Registration confirmed"}>
        {invoice.totalAmount > 0 && payment?.transactionId ? (
          <>Transaction ID <strong className="font-mono">{payment.transactionId}</strong> · {formatPaisa(invoice.totalAmount)}. </>
        ) : null}
        Your courses are now open in your course space.
      </Banner>
    );
  }
  if (reg.paymentInProgress) {
    return (
      <Banner tone="pending" icon={<Loader2 className="size-5 animate-spin" aria-hidden="true" />} title="Confirming your payment with bKash">
        This usually takes a few seconds. This page updates by itself; do not pay again.
      </Banner>
    );
  }
  if (invoice.status === "FAILED" && highlight) {
    return (
      <Banner tone="error" icon={<CircleAlert className="size-5" aria-hidden="true" />} title="Payment did not go through">
        {payment?.failureReason ? `bKash reported: ${payment.failureReason}. ` : ""}No registration was lost. You can try the payment again.
      </Banner>
    );
  }
  if (invoice.status === "EXPIRED" || reg.status === "EXPIRED") {
    return (
      <Banner tone="muted" icon={<Clock className="size-5" aria-hidden="true" />} title="This invoice expired">
        It was not paid in time, so the seats were released. Start a new registration if registration is still open.
      </Banner>
    );
  }
  if (reg.status === "CANCELLED" || reg.status === "REJECTED") {
    return (
      <Banner tone="muted" icon={<Ban className="size-5" aria-hidden="true" />} title={reg.status === "REJECTED" ? "Registration rejected" : "Registration cancelled"}>
        The seats were released.
      </Banner>
    );
  }
  if (reg.canPay) {
    return (
      <Banner tone="warning" icon={<Clock className="size-5" aria-hidden="true" />} title="Payment is due">
        Pay before <strong>{formatDateTime(invoice.expiresAt)}</strong> to keep your seats.
      </Banner>
    );
  }
  return null;
}

function Banner({ tone, icon, title, children }: { tone: "success" | "pending" | "error" | "warning" | "muted"; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  const styles = {
    success: "border-success/40 bg-success/10",
    pending: "border-brand-sky/40 bg-brand-sky/10",
    error: "border-destructive/40 bg-destructive/10",
    warning: "border-warning/50 bg-warning/15",
    muted: "bg-muted/50",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("flex gap-3 rounded-xl border p-4", styles)}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div className="space-y-0.5 text-sm">
        <p className="text-base font-semibold">{title}</p>
        <p className="text-muted-foreground">{children}</p>
      </div>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-16 w-full rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );
}
