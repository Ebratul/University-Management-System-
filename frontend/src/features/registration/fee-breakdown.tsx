import { formatPaisa } from "@/lib/format";
import { cn } from "@/lib/utils";

type Fees = {
  theoryCredits: number;
  practicalCredits: number;
  otherCredits: number;
  theoryRate: number;
  practicalRate: number;
  otherRate: number;
  theoryFee: number;
  practicalFee: number;
  otherFee: number;
  registrationFee: number;
  lateFee: number;
  totalAmount: number;
};

/**
 * The fee lines of an invoice or a preview, always shown the same way:
 * credits x rate = amount, then the flat fees, then the total.
 */
export function FeeBreakdown({ fees, className }: { fees: Fees; className?: string }) {
  const credit = (label: string, credits: number, rate: number, amount: number) =>
    credits > 0 || amount > 0 ? (
      <Line key={label} label={label} detail={`${credits} × ${formatPaisa(rate)}`} amount={amount} />
    ) : null;

  return (
    <dl className={cn("space-y-2 text-sm", className)}>
      {credit("Theory credit fee", fees.theoryCredits, fees.theoryRate, fees.theoryFee)}
      {credit("Practical credit fee", fees.practicalCredits, fees.practicalRate, fees.practicalFee)}
      {credit("Project / thesis credit fee", fees.otherCredits, fees.otherRate, fees.otherFee)}
      <Line label="Registration fee" amount={fees.registrationFee} />
      <Line label="Late fee" amount={fees.lateFee} muted={fees.lateFee === 0} />
      <div className="flex items-baseline justify-between border-t pt-3 text-base font-semibold">
        <dt>Total</dt>
        <dd className="tabular-nums">{formatPaisa(fees.totalAmount)}</dd>
      </div>
    </dl>
  );
}

function Line({ label, detail, amount, muted }: { label: string; detail?: string; amount: number; muted?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", muted && "text-muted-foreground")}>
      <dt className="min-w-0">
        {label}
        {detail ? <span className="text-muted-foreground ml-2 text-xs">{detail}</span> : null}
      </dt>
      <dd className="tabular-nums">{formatPaisa(amount)}</dd>
    </div>
  );
}
