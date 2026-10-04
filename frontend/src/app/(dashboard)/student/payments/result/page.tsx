import type { Metadata } from "next";
import { PaymentResult } from "@/components/student/payment-result";

export const metadata: Metadata = {
  title: "Payment result",
};

export default async function Page({ searchParams }: PageProps<"/student/payments/result">) {
  const params = await searchParams;
  const paymentId = typeof params.paymentId === "string" ? params.paymentId : null;
  return <PaymentResult paymentId={paymentId} />;
}
