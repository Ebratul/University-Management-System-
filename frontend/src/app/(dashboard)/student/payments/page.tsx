import type { Metadata } from "next";
import { MyPayments } from "@/components/student/my-payments";

export const metadata: Metadata = {
  title: "Payments",
};

export default function Page() {
  return <MyPayments />;
}
