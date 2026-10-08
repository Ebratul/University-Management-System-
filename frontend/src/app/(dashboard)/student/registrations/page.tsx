import type { Metadata } from "next";

import { RegistrationHistory } from "@/features/registration/registration-history";

export const metadata: Metadata = {
  title: "My registrations",
};

export default function Page() {
  return <RegistrationHistory />;
}
