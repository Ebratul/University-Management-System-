import type { Metadata } from "next";
import { MyEnrollments } from "@/components/student/my-enrollments";

export const metadata: Metadata = {
  title: "My enrolments",
};

export default function Page() {
  return <MyEnrollments />;
}
