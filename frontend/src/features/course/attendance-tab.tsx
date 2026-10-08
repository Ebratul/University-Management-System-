"use client";

import { useState } from "react";
import { CalendarCheck, Check, Loader2, X } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { SectionCard } from "@/components/shared/section-card";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { attendanceApi } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/query-keys";
import { formatDate, todayLocalIso } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { AttendanceRoster, AttendanceStatus } from "@/types/entities";

export function AttendanceTab({ offeringId, isStaff }: { offeringId: string; isStaff: boolean }) {
  return isStaff ? <TeacherAttendance offeringId={offeringId} /> : <StudentAttendance offeringId={offeringId} />;
}

// ------------------------------ Teacher ------------------------------

function TeacherAttendance({ offeringId }: { offeringId: string }) {
  const [date, setDate] = useState(todayLocalIso);

  const roster = useApiQuery({
    queryKey: queryKeys.course.attendanceRoster(offeringId, date),
    queryFn: () => attendanceApi.roster(offeringId, date),
    enabled: Boolean(date),
  });

  return (
    <div className="space-y-6">
      <SectionCard title="Roll call" description="Pick a class date, mark each student, then save. Saving the same date again updates it.">
        <div className="space-y-5">
          <div className="max-w-xs space-y-2">
            <Label htmlFor="attendance-date">Class date</Label>
            <Input id="attendance-date" type="date" value={date} max={todayLocalIso()} onChange={(event) => setDate(event.target.value)} className="h-10" />
          </div>

          {roster.isPending ? (
            <Skeleton className="h-48 w-full rounded-xl" />
          ) : roster.isError ? (
            <EmptyState
              icon={CalendarCheck}
              title="Could not load the class list"
              description={roster.error.message}
              action={
                <Button variant="outline" onClick={() => void roster.refetch()}>
                  Try again
                </Button>
              }
            />
          ) : roster.data.students.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="No enrolled students" description="Students appear here once their enrolment is confirmed." />
          ) : (
            // Keyed by date: switching day starts a fresh draft from that day's saved marks.
            <RosterEditor key={roster.data.date} offeringId={offeringId} roster={roster.data} />
          )}
        </div>
      </SectionCard>

      <AttendanceSummaryCard offeringId={offeringId} />
    </div>
  );
}

function RosterEditor({ offeringId, roster }: { offeringId: string; roster: AttendanceRoster }) {
  const [draft, setDraft] = useState<Record<string, AttendanceStatus | null>>(() =>
    Object.fromEntries(roster.students.map((s) => [s.id, s.status])),
  );

  const save = useApiMutation({
    mutationFn: () =>
      attendanceApi.mark(offeringId, {
        date: roster.date,
        records: roster.students.flatMap((s) => (draft[s.id] ? [{ studentId: s.id, status: draft[s.id] as AttendanceStatus }] : [])),
      }),
    successMessage: `Attendance saved for ${formatDate(`${roster.date}T00:00:00Z`)}.`,
    invalidate: [queryKeys.course.attendanceAll(offeringId)],
  });

  const marked = roster.students.filter((s) => draft[s.id]).length;
  const present = roster.students.filter((s) => draft[s.id] === "PRESENT").length;
  const set = (id: string, status: AttendanceStatus) => setDraft((d) => ({ ...d, [id]: status }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {roster.alreadyMarked ? <Badge variant="secondary">Already marked — editing</Badge> : <Badge variant="outline">New roll call</Badge>}
        <span className="text-muted-foreground text-sm tabular-nums">
          {marked} of {roster.students.length} marked · {present} present
        </span>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setDraft(Object.fromEntries(roster.students.map((s) => [s.id, "PRESENT" as const])))}>
            Mark all present
          </Button>
          <Button variant="outline" size="sm" onClick={() => setDraft(Object.fromEntries(roster.students.map((s) => [s.id, null])))}>
            Clear
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <Table>
          <caption className="sr-only">Students and their attendance for {roster.date}</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Student</TableHead>
              <TableHead className="hidden sm:table-cell">Registration no.</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {roster.students.map((s) => (
              <TableRow key={s.id}>
                <TableCell>
                  <div className="flex min-w-0 items-center gap-3">
                    <PersonAvatar name={s.name} imageUrl={s.imageUrl} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{s.name}</p>
                      <p className="text-muted-foreground font-mono text-xs sm:hidden">{s.registrationNumber}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="hidden font-mono text-xs sm:table-cell">{s.registrationNumber}</TableCell>
                <TableCell>
                  <div role="group" aria-label={`Attendance for ${s.name}`} className="flex justify-end gap-1.5">
                    <StatusButton active={draft[s.id] === "PRESENT"} tone="present" onClick={() => set(s.id, "PRESENT")}>
                      <Check className="size-4" aria-hidden="true" /> Present
                    </StatusButton>
                    <StatusButton active={draft[s.id] === "ABSENT"} tone="absent" onClick={() => set(s.id, "ABSENT")}>
                      <X className="size-4" aria-hidden="true" /> Absent
                    </StatusButton>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end">
        <Button disabled={marked === 0 || save.isPending} onClick={() => save.mutate()} className="bg-brand-gradient text-white hover:opacity-90">
          {save.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Saving…
            </>
          ) : (
            "Save attendance"
          )}
        </Button>
      </div>
    </div>
  );
}

function StatusButton({ active, tone, onClick, children }: { active: boolean; tone: "present" | "absent"; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "focus-visible:ring-ring/50 inline-flex h-8 items-center gap-1 rounded-md border px-2.5 text-xs font-medium transition-colors outline-none focus-visible:ring-3",
        active && tone === "present" && "border-success bg-success/15 text-success",
        active && tone === "absent" && "border-destructive bg-destructive/10 text-destructive",
        !active && "text-muted-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function AttendanceSummaryCard({ offeringId }: { offeringId: string }) {
  const summary = useApiQuery({
    queryKey: queryKeys.course.attendanceSummary(offeringId),
    queryFn: () => attendanceApi.summary(offeringId),
  });

  return (
    <SectionCard title="Attendance summary" description={summary.data ? `${summary.data.totalClassDays} class day(s) recorded` : undefined}>
      {summary.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : summary.isError ? (
        <p className="text-destructive text-sm">{summary.error.message}</p>
      ) : summary.data.totalClassDays === 0 ? (
        <p className="text-muted-foreground text-sm">No attendance has been recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <caption className="sr-only">Attendance totals per student</caption>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead className="text-right">Present</TableHead>
                <TableHead className="text-right">Absent</TableHead>
                <TableHead className="w-44">Attendance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.data.students.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <div className="flex min-w-0 items-center gap-3">
                      <PersonAvatar name={s.name} imageUrl={s.imageUrl} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{s.name}</p>
                        <p className="text-muted-foreground font-mono text-xs">{s.registrationNumber}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{s.present}</TableCell>
                  <TableCell className="text-right tabular-nums">{s.absent}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={s.percentage} aria-label={`${s.name} attendance`} className={cn(s.percentage < 75 && "[&>div]:bg-warning")} />
                      <span className="w-12 text-right text-xs tabular-nums">{s.percentage}%</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </SectionCard>
  );
}

// ------------------------------ Student ------------------------------

function StudentAttendance({ offeringId }: { offeringId: string }) {
  const mine = useApiQuery({
    queryKey: queryKeys.course.attendanceMine(offeringId),
    queryFn: () => attendanceApi.mine(offeringId),
  });

  if (mine.isPending) return <Skeleton className="h-64 w-full rounded-xl" />;
  if (mine.isError) {
    return (
      <EmptyState
        icon={CalendarCheck}
        title="Could not load your attendance"
        description={mine.error.message}
        action={
          <Button variant="outline" onClick={() => void mine.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  const a = mine.data;
  if (a.totalClasses === 0) {
    return <EmptyState icon={CalendarCheck} title="No classes recorded yet" description="Your attendance will appear here after your teacher takes the first roll call." />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total classes" value={a.totalClasses} icon={CalendarCheck} tone="indigo" />
        <StatCard label="Present" value={a.present} icon={Check} tone="teal" />
        <StatCard label="Absent" value={a.absent} icon={X} tone="rose" />
        <StatCard label="Attendance" value={`${a.percentage}%`} hint={a.percentage < 75 ? "Below 75%" : "On track"} icon={CalendarCheck} tone={a.percentage < 75 ? "amber" : "violet"} />
      </div>

      <SectionCard title="Class by class">
        <Table>
          <caption className="sr-only">Your attendance by date</caption>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {a.records.map((r) => (
              <TableRow key={r.date}>
                <TableCell>{formatDate(`${r.date}T00:00:00Z`)}</TableCell>
                <TableCell className="text-right">
                  <Badge variant="outline" className={cn("border-transparent", r.status === "PRESENT" ? "bg-success/15 text-success" : "bg-destructive/10 text-destructive")}>
                    {r.status === "PRESENT" ? "Present" : "Absent"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </SectionCard>
    </div>
  );
}
