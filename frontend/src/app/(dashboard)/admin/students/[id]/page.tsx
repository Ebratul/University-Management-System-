import type { Metadata } from "next";

import { StudentDetail } from "@/features/students/student-detail";

export const metadata: Metadata = {
  title: "Student",
};

export default async function StudentPage({ params }: PageProps<"/admin/students/[id]">) {
  const { id } = await params;
  return <StudentDetail id={id} />;
}
