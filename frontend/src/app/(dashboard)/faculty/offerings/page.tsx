import type { Metadata } from "next";

import { MyOfferings } from "@/components/faculty/my-offerings";

export const metadata: Metadata = {
  title: "My offerings",
};

export default function OfferingsPage() {
  return <MyOfferings />;
}
