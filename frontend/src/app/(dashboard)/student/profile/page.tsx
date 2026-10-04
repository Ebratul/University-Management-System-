import type { Metadata } from "next";
import { ProfileForm } from "@/components/student/profile-form";

export const metadata: Metadata = {
  title: "Profile",
};

export default function Page() {
  return <ProfileForm />;
}
