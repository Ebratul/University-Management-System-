import type { Metadata } from "next";
import { CourseEnrolment } from "@/components/student/course-enrolment";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = {
  title: "Courses",
};

export default function Page() {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Academics" title="Enrol in courses" description="Pick a semester, then enrol in any course that still has free seats." />
      <CourseEnrolment />
    </div>
  );
}
