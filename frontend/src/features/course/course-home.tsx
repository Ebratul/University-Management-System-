"use client";

import { useState } from "react";
import Link from "next/link";
import { BookOpen, CalendarCheck, FileText, LayoutDashboard, ListChecks, Users } from "lucide-react";

import { useSession } from "@/components/auth/session-provider";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiQuery } from "@/hooks/use-api-query";
import { offeringApi } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/query-keys";
import { AttendanceTab } from "./attendance-tab";
import { MaterialsTab } from "./materials-tab";
import { OverviewTab } from "./overview-tab";
import { QuizzesTab } from "./quizzes-tab";
import { OfferingStudents } from "@/components/faculty/offering-students";

type TabId = "overview" | "materials" | "attendance" | "quizzes" | "students";

/**
 * One course as its own space: header, then Overview / Materials / Attendance /
 * Quizzes / Students. Used by teachers (and admins) and by enrolled students.
 * What each person can do inside a tab is decided by the API, not by this file:
 * hiding a button here is only a convenience.
 */
export function CourseHome({ offeringId }: { offeringId: string }) {
  const user = useSession();
  const isStaff = user.role !== "STUDENT";
  const [tab, setTab] = useState<TabId>("overview");

  const offering = useApiQuery({
    queryKey: queryKeys.course.offering(offeringId),
    queryFn: () => offeringApi.get(offeringId),
  });

  const backHref = isStaff ? (user.role === "ADMIN" ? "/admin/offerings" : "/faculty/offerings") : "/student/enrollments";
  const backLabel = isStaff ? (user.role === "ADMIN" ? "Offerings" : "My offerings") : "My enrolments";

  if (offering.isPending) return <CourseHomeSkeleton />;

  if (offering.isError || !offering.data) {
    return (
      <EmptyState
        icon={BookOpen}
        title="This course is not available"
        description={offering.error?.message ?? "It may not exist, or you may not have access to it."}
        action={
          <Button asChild variant="outline">
            <Link href={backHref}>Back to {backLabel.toLowerCase()}</Link>
          </Button>
        }
      />
    );
  }

  const o = offering.data;

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
        <Link href={backHref} className="hover:text-foreground underline-offset-4 hover:underline">
          {backLabel}
        </Link>
      </nav>

      <header className="bg-card overflow-hidden rounded-2xl border shadow-sm">
        <div className="bg-brand-gradient relative px-5 py-6 text-white sm:px-8 sm:py-8">
          <div aria-hidden="true" className="absolute -top-16 -right-16 size-56 rounded-full bg-white/10 blur-2xl" />
          <div className="relative space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="border-transparent bg-white/20 font-mono text-white">{o.course.courseCode}</Badge>
              <Badge className="border-transparent bg-white/20 text-white">
                {o.semester.code} {o.semester.year}
              </Badge>
              <Badge className="border-transparent bg-white/20 text-white capitalize">{o.semester.status.toLowerCase()}</Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">{o.course.title}</h1>
          </div>
        </div>
        <dl className="grid gap-4 px-5 py-4 text-sm sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
          <HeaderFact label="Teacher">
            <span className="flex items-center gap-2">
              <PersonAvatar name={o.faculty.name} imageUrl={o.faculty.user?.imageUrl} size="sm" />
              <span className="truncate font-medium">{o.faculty.name}</span>
            </span>
          </HeaderFact>
          <HeaderFact label="Department">{o.course.department?.name ?? "—"}</HeaderFact>
          <HeaderFact label="Session">
            {o.semester.code} {o.semester.year}
          </HeaderFact>
          <HeaderFact label="Credits · Students">
            {o.course.credits} · {o.enrolledCount} enrolled
          </HeaderFact>
        </dl>
      </header>

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabId)} className="gap-6">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList variant="line" className="h-10 w-max min-w-full justify-start gap-2 border-b pb-0 sm:w-full">
            <TabsTrigger value="overview" className="flex-none px-3">
              <LayoutDashboard aria-hidden="true" /> Overview
            </TabsTrigger>
            <TabsTrigger value="materials" className="flex-none px-3">
              <FileText aria-hidden="true" /> Materials
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex-none px-3">
              <CalendarCheck aria-hidden="true" /> Attendance
            </TabsTrigger>
            <TabsTrigger value="quizzes" className="flex-none px-3">
              <ListChecks aria-hidden="true" /> Quizzes
            </TabsTrigger>
            {isStaff ? (
              <TabsTrigger value="students" className="flex-none px-3">
                <Users aria-hidden="true" /> Students
              </TabsTrigger>
            ) : null}
          </TabsList>
        </div>

        <TabsContent value="overview" className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
          <OverviewTab offering={o} isStaff={isStaff} onNavigate={setTab} />
        </TabsContent>
        <TabsContent value="materials" className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
          <MaterialsTab offeringId={offeringId} isStaff={isStaff} />
        </TabsContent>
        <TabsContent value="attendance" className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
          <AttendanceTab offeringId={offeringId} isStaff={isStaff} />
        </TabsContent>
        <TabsContent value="quizzes" className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
          <QuizzesTab offeringId={offeringId} isStaff={isStaff} />
        </TabsContent>
        {isStaff ? (
          <TabsContent value="students" className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
            <OfferingStudents id={offeringId} embedded />
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}

function HeaderFact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</dt>
      <dd className="truncate">{children}</dd>
    </div>
  );
}

function CourseHomeSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading course">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-52 w-full rounded-2xl" />
      <Skeleton className="h-10 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
