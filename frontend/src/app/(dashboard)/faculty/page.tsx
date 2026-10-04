import type { Metadata } from "next";

import { FacultyOverview } from "@/components/faculty/faculty-overview";

export const metadata: Metadata = {
  title: "Teaching",
};

export default function FacultyHomePage() {
  return <FacultyOverview />;
}
