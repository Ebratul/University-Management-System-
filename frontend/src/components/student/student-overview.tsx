"use client";

import Link from "next/link";
import { BadgeDollarSign, Bell, BookOpen, GraduationCap } from "lucide-react";

import { NoticeCard } from "@/components/catalog/cards";
import { useSession } from "@/components/auth/session-provider";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiListRequest } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import { getDisplayName } from "@/lib/auth/user";
import { gradePointAverage } from "@/lib/academics/gpa";
import type { Enrollment, Notice, Payment, Result } from "@/types/entities";

const money = new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", maximumFractionDigits: 0 });

export function StudentOverview() {
  const user = useSession();
  const enrollments = useApiQuery({ queryKey: queryKeys.enrollments.list({ mine: true }), queryFn: () => apiListRequest<Enrollment>("/enrollments", { limit: 100 }) });
  const payments = useApiQuery({ queryKey: queryKeys.payments.list({ mine: true }), queryFn: () => apiListRequest<Payment>("/payments", { limit: 100 }) });
  const results = useApiQuery({ queryKey: queryKeys.results.list({ mine: true }), queryFn: () => apiListRequest<Result>("/results", { limit: 100 }) });
  const notices = useApiQuery({ queryKey: queryKeys.notices.list({ limit: 3, sortBy: "createdAt", sortOrder: "desc" }), queryFn: () => apiListRequest<Notice>("/notices", { limit: 3, sortBy: "createdAt", sortOrder: "desc" }) });

  const active = enrollments.data?.data.filter((e) => e.status === "ENROLLED").length;
  const pending = payments.data?.data.filter((p) => p.status === "PENDING").length;
  const paid = payments.data?.data.filter((p) => p.status === "PAID").reduce((sum, p) => sum + p.amount, 0);
  const gpa = gradePointAverage(results.data?.data);

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={user.student?.studentId ?? "Student"}
        title={`Welcome, ${getDisplayName(user).split(" ")[0]}`}
        description="Your courses, results and fees at a glance."
        actions={
          <Button asChild className="bg-brand-gradient text-white hover:opacity-90">
            <Link href="/student/courses">Browse courses</Link>
          </Button>
        }
      />

      <section aria-labelledby="stats-heading" className="space-y-4">
        <h2 id="stats-heading" className="sr-only">Summary</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {enrollments.isPending || payments.isPending || results.isPending ? (
            Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : (
            <>
              <StatCard label="Active courses" value={active ?? 0} hint="Currently enrolled" icon={BookOpen} tone="indigo" />
              <StatCard label="Grade point average" value={gpa === null ? "—" : gpa.toFixed(2)} hint={gpa === null ? "No results yet" : "Weighted by credits"} icon={GraduationCap} tone="violet" />
              <StatCard label="Fees paid" value={money.format(paid ?? 0)} hint={pending ? `${pending} payment(s) pending` : "No pending payments"} icon={BadgeDollarSign} tone="teal" />
              <StatCard label="Results published" value={results.data?.meta.total ?? 0} hint="Across all semesters" icon={GraduationCap} tone="amber" />
            </>
          )}
        </div>
      </section>

      <section aria-labelledby="notices-heading" className="space-y-4">
        <div className="flex items-end justify-between">
          <h2 id="notices-heading" className="text-lg font-semibold tracking-tight">Latest notices</h2>
          <Button asChild variant="ghost" size="sm"><Link href="/student/notices">All notices</Link></Button>
        </div>
        {notices.isPending ? (
          <Skeleton className="h-32 w-full rounded-xl" />
        ) : notices.data && notices.data.data.length > 0 ? (
          <ul className="grid gap-4 md:grid-cols-3">
            {notices.data.data.map((notice) => (
              <li key={notice.id}><NoticeCard notice={notice} /></li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground flex items-center gap-2 text-sm"><Bell className="size-4" aria-hidden="true" />No notices for you right now.</p>
        )}
      </section>
    </div>
  );
}
