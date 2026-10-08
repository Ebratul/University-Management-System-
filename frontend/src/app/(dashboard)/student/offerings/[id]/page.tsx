import type { Metadata } from "next";

import { CourseHome } from "@/features/course/course-home";

export const metadata: Metadata = {
  title: "Course",
};

export default async function StudentOfferingPage({ params }: PageProps<"/student/offerings/[id]">) {
  const { id } = await params;
  return <CourseHome offeringId={id} />;
}
