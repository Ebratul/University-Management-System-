import type { Metadata } from "next";

import { CourseRegistration } from "@/features/registration/course-registration";

export const metadata: Metadata = {
  title: "Course registration",
};

export default function Page() {
  return <CourseRegistration />;
}
