import type { Metadata } from "next";

import { RegistrationDetail } from "@/features/registration/registration-detail";

export const metadata: Metadata = {
  title: "Registration",
};

export default async function Page({ params, searchParams }: PageProps<"/student/registration/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  // bKash sends the payer back here with ?paymentId=...
  const returnedFromGateway = typeof query.paymentId === "string";
  return <RegistrationDetail registrationId={id} viewer="student" returnedFromGateway={returnedFromGateway} />;
}
