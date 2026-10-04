import type { Metadata } from "next";

import { OfferingStudents } from "@/components/faculty/offering-students";

export const metadata: Metadata = {
  title: "Course students",
};

export default async function OfferingPage({ params }: PageProps<"/faculty/offerings/[id]">) {
  const { id } = await params;
  return <OfferingStudents id={id} />;
}
