import type { Metadata } from "next";
import { StudentOverview } from "@/components/student/student-overview";

export const metadata: Metadata = {
  title: "My studies",
};

export default function Page() {
  return <StudentOverview />;
}
