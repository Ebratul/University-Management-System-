"use client";

import Link from "next/link";
import { Award, BookOpen, Users } from "lucide-react";

import { useSession } from "@/components/auth/session-provider";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiListRequest } from "@/lib/api/client";
import { queryKeys } from "@/lib/api/query-keys";
import type { CourseOffering, Result } from "@/types/entities";

export function FacultyOverview() {
  const user = useSession();
  const facultyId = user.faculty?.id;

  const offeringsQuery = { facultyId, limit: 100 };
  const offerings = useApiQuery({
    queryKey: queryKeys.courseOfferings.list(offeringsQuery),
    queryFn: () => apiListRequest<CourseOffering>("/course-offerings", offeringsQuery),
    enabled: Boolean(facultyId),
  });
  const results = useApiQuery({
    queryKey: queryKeys.results.list({ mine: true }),
    queryFn: () => apiListRequest<Result>("/results", { limit: 1 }),
  });

  const students = offerings.data?.data.reduce((sum, o) => sum + o.enrolledCount, 0) ?? 0;

  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow={user.faculty?.facultyId ?? "Faculty"}
        title={`Hello, ${user.faculty?.name.split(" ")[0] ?? "there"}`}
        description="Your teaching load and the results you have published."
        actions={
          <Button asChild className="bg-brand-gradient text-white hover:opacity-90">
            <Link href="/faculty/offerings">Open my courses</Link>
          </Button>
        }
      />

      {offerings.isPending || results.isPending ? (
        <div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Courses taught" value={offerings.data?.data.length ?? 0} hint={`${offerings.data?.data.filter((o) => o.semester.status !== "COMPLETED").length ?? 0} of 5 course slots in use`} icon={BookOpen} tone="indigo" />
          <StatCard label="Students across courses" value={students} hint="Enrolled right now" icon={Users} tone="teal" />
          <StatCard label="Results published" value={results.data?.meta.total ?? 0} hint="All your published grades" icon={Award} tone="violet" />
        </div>
      )}
    </div>
  );
}
