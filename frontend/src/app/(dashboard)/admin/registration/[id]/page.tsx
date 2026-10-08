import type { Metadata } from "next";

import { RegistrationDetail } from "@/features/registration/registration-detail";

export const metadata: Metadata = {
  title: "Registration",
};

export default async function Page({ params }: PageProps<"/admin/registration/[id]">) {
  const { id } = await params;
  return <RegistrationDetail registrationId={id} viewer="admin" />;
}
