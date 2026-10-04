import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/format";
import { getAllNotices, getNotice } from "@/lib/api/public-data";

/** Pre-renders every public notice. Newer notices are generated on first visit, then cached. */
export async function generateStaticParams() {
  const notices = await getAllNotices().catch(() => []);
  return notices.map((notice) => ({ id: notice.id }));
}

export async function generateMetadata({ params }: PageProps<"/notices/[id]">): Promise<Metadata> {
  const { id } = await params;
  const notice = await getNotice(id);
  if (!notice) return { title: "Notice not found" };

  return { title: notice.title, description: notice.content.slice(0, 160) };
}

export default async function NoticePage({ params }: PageProps<"/notices/[id]">) {
  const { id } = await params;
  const notice = await getNotice(id);
  if (!notice) notFound();

  return (
    <article className="mx-auto w-full max-w-3xl space-y-8 px-4 py-12 sm:px-6 lg:px-8">
      <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
        <Link href="/notices" className="hover:text-foreground underline-offset-4 hover:underline">
          Notices
        </Link>
      </nav>

      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="secondary">Everyone</Badge>
          <time dateTime={notice.createdAt} className="text-muted-foreground text-sm">
            {formatDate(notice.createdAt)}
          </time>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">{notice.title}</h1>
      </header>

      <div className="text-foreground/90 text-base leading-relaxed whitespace-pre-line text-pretty">
        {notice.content}
      </div>
    </article>
  );
}
