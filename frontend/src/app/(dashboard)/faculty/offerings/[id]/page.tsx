import type { Metadata } from "next";

import { CourseHome } from "@/features/course/course-home";

export const metadata: Metadata = {
  title: "Course",
};

export default async function OfferingPage({ params }: PageProps<"/faculty/offerings/[id]">) {
  const { id } = await params;
  return <CourseHome offeringId={id} />;
}
