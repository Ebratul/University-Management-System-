import type { Metadata } from "next";

import { ReceiptView } from "@/features/registration/receipt-view";

export const metadata: Metadata = {
  title: "Registration receipt",
};

export default async function Page({ params }: PageProps<"/admin/registration/[id]/receipt">) {
  const { id } = await params;
  return <ReceiptView registrationId={id} backHref={`/admin/registration/${id}`} />;
}
