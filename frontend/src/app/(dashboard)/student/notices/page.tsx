import type { Metadata } from "next";
import { NoticesFeed } from "@/components/catalog/notices-feed";

export const metadata: Metadata = {
  title: "Notices",
};

export default function Page() {
  return <NoticesFeed />;
}
