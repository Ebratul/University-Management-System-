import type { Metadata } from "next";
import { MyResults } from "@/components/student/my-results";

export const metadata: Metadata = {
  title: "Results",
};

export default function Page() {
  return <MyResults />;
}
