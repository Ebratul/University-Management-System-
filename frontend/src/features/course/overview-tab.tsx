"use client";

import { CalendarCheck, FileText, ListChecks, Users } from "lucide-react";

import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { useApiQuery } from "@/hooks/use-api-query";
import { attendanceApi, materialApi, quizApi } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/query-keys";
import { formatBytes, formatDate } from "@/lib/format";
import { QuizStatusBadge } from "@/features/quiz/quiz-status-badge";
import type { CourseOffering } from "@/types/entities";

type TabId = "overview" | "materials" | "attendance" | "quizzes" | "students";

/** Course description, key numbers, and the latest materials and quizzes. */
export function OverviewTab({
  offering,
  isStaff,
  onNavigate,
}: {
  offering: CourseOffering;
  isStaff: boolean;
  onNavigate: (tab: TabId) => void;
}) {
  const id = offering.id;

  // Same keys as the tabs themselves, so opening a tab afterwards costs nothing.
  const materials = useApiQuery({ queryKey: queryKeys.course.materials(id), queryFn: () => materialApi.list(id) });
  const quizzes = useApiQuery({ queryKey: queryKeys.course.quizzes(id), queryFn: () => quizApi.list(id) });
  const attendanceSummary = useApiQuery({
    queryKey: queryKeys.course.attendanceSummary(id),
    queryFn: () => attendanceApi.summary(id),
    enabled: isStaff,
  });
  const myAttendance = useApiQuery({
    queryKey: queryKeys.course.attendanceMine(id),
    queryFn: () => attendanceApi.mine(id),
    enabled: !isStaff,
  });

  const quizList = quizzes.data?.quizzes ?? [];
  const activeQuizzes = quizList.filter((q) => q.status === "ACTIVE");
  const visibleQuizzes = quizList.slice(0, 3);
  const recentMaterials = (materials.data ?? []).slice(0, 3);

  let attendanceValue = "—";
  let attendanceHint = "No classes recorded yet";
  if (isStaff && attendanceSummary.data && attendanceSummary.data.totalClassDays > 0) {
    const students = attendanceSummary.data.students;
    const avg = students.length ? students.reduce((sum, s) => sum + s.percentage, 0) / students.length : 0;
    attendanceValue = `${Math.round(avg)}%`;
    attendanceHint = `Average over ${attendanceSummary.data.totalClassDays} class day(s)`;
  } else if (!isStaff && myAttendance.data && myAttendance.data.totalClasses > 0) {
    attendanceValue = `${Math.round(myAttendance.data.percentage)}%`;
    attendanceHint = `${myAttendance.data.present} of ${myAttendance.data.totalClasses} classes`;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Materials" value={materials.data?.length ?? "…"} hint="PDFs shared in this course" icon={FileText} tone="indigo" />
        <StatCard
          label="Quizzes"
          value={quizzes.data ? quizList.length : "…"}
          hint={activeQuizzes.length ? `${activeQuizzes.length} active now` : "None active"}
          icon={ListChecks}
          tone="violet"
        />
        <StatCard label="Students" value={offering.enrolledCount} hint={`${offering.maxSeats} seats`} icon={Users} tone="teal" />
        <StatCard label={isStaff ? "Average attendance" : "My attendance"} value={attendanceValue} hint={attendanceHint} icon={CalendarCheck} tone="amber" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard title="About this course" className="lg:col-span-2">
          {offering.course.description ? (
            <p className="text-sm leading-relaxed whitespace-pre-line">{offering.course.description}</p>
          ) : (
            <p className="text-muted-foreground text-sm">No description has been added for this course yet.</p>
          )}
        </SectionCard>

        <SectionCard
          title="Recent materials"
          action={
            <Button variant="ghost" size="sm" onClick={() => onNavigate("materials")}>
              View all
            </Button>
          }
        >
          {recentMaterials.length === 0 ? (
            <p className="text-muted-foreground text-sm">Nothing has been uploaded yet.</p>
          ) : (
            <ul className="space-y-3">
              {recentMaterials.map((m) => (
                <li key={m.id} className="flex items-start gap-3">
                  <FileText className="text-brand-indigo mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{m.title}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatDate(m.createdAt)} · {formatBytes(m.fileSize)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SectionCard
        title="Quizzes"
        action={
          <Button variant="ghost" size="sm" onClick={() => onNavigate("quizzes")}>
            View all
          </Button>
        }
      >
        {visibleQuizzes.length === 0 ? (
          <p className="text-muted-foreground text-sm">{isStaff ? "You have not created a quiz yet." : "No quizzes yet."}</p>
        ) : (
          <ul className="divide-y">
            {visibleQuizzes.map((q) => (
              <li key={q.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
                <span className="truncate text-sm font-medium">{q.title}</span>
                <QuizStatusBadge status={q.status} />
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}
