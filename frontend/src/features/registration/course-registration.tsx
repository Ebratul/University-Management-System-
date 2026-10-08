"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarClock, CircleAlert, GraduationCap, Loader2, Search, ShoppingBag } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { SectionCard } from "@/components/shared/section-card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { registrationApi } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/query-keys";
import { formatDateTime, formatPaisa } from "@/lib/format";
import { ordinal } from "@/lib/validations/admin";
import { cn } from "@/lib/utils";
import type { AvailableCourse, AvailableCourses, CourseType } from "@/types/entities";
import { FeeBreakdown } from "./fee-breakdown";
import { CourseStateBadge, RegistrationStatusBadge, WindowStateBadge } from "./registration-status";

const TYPE_LABEL: Record<CourseType, string> = {
  THEORY: "Theory",
  PRACTICAL: "Practical",
  PROJECT: "Project",
  THESIS: "Thesis",
  OTHER: "Other",
};

/**
 * Student course registration. The student only chooses WHICH courses; every
 * rule (department, level, prerequisites, seats, credit limits, deadline) and
 * every taka is decided by the server. The summary on the right is the server's
 * answer to "if I submitted this now", refreshed on each change.
 */
export function CourseRegistration() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"ALL" | CourseType>("ALL");
  const [confirming, setConfirming] = useState(false);

  const available = useApiQuery({
    queryKey: queryKeys.registrations.available(),
    queryFn: () => registrationApi.available(),
  });
  const data = available.data;
  const semesterId = data?.semester?.id;
  const windowState = data?.window?.state;
  const open = windowState === "OPEN" || windowState === "LATE";
  const canSelect = open && !data?.existingRegistration;
  const sortedSelection = [...selected].sort();

  const preview = useApiQuery({
    queryKey: [...queryKeys.registrations.all, "preview", semesterId ?? "none", ...sortedSelection],
    queryFn: () => registrationApi.preview({ semesterId: semesterId as string, offeringIds: sortedSelection }),
    enabled: Boolean(semesterId) && canSelect && selected.length > 0,
    keepPreviousData: true,
    staleTime: 0,
  });

  const submit = useApiMutation({
    mutationFn: () => registrationApi.submit({ semesterId: semesterId as string, offeringIds: sortedSelection }),
    successMessage: "Registration submitted. Your invoice is ready.",
    invalidate: [queryKeys.registrations.all],
    onSuccess: (registration) => router.push(`/student/registration/${registration.id}`),
  });

  if (available.isPending) return <PageSkeleton />;
  if (available.isError || !data) {
    return (
      <EmptyState
        icon={ShoppingBag}
        title="Could not load course registration"
        description={available.error?.message}
        action={
          <Button variant="outline" onClick={() => void available.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }
  if (!data.semester) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Academics" title="Course registration" />
        <EmptyState icon={CalendarClock} title="No registration is open right now" description="When the university opens registration for a semester, its courses appear here." />
      </div>
    );
  }

  const q = search.trim().toLowerCase();
  const courses = data.courses.filter(
    (c) =>
      (type === "ALL" || c.courseType === type) &&
      (q === "" || c.courseCode.toLowerCase().includes(q) || c.title.toLowerCase().includes(q)),
  );
  const toggle = (offeringId: string) =>
    setSelected((current) => (current.includes(offeringId) ? current.filter((id) => id !== offeringId) : [...current, offeringId]));

  const summary = preview.data?.summary;
  const issues = preview.data?.issues ?? [];
  const selectedCourses = data.courses.filter((c) => selected.includes(c.offeringId));
  const total = summary?.fees.totalAmount ?? 0;

  return (
    <div className="space-y-6 pb-24 lg:pb-0">
      <PageHeader
        eyebrow={`${data.semester.code} ${data.semester.year}`}
        title="Course registration"
        description={`Courses for your department, ${data.student ? ordinal(data.student.currentSemesterLevel) : ""} semester. Select the courses you want, review the fee, then submit.`}
        actions={<Button asChild variant="outline"><Link href="/student/registrations">My registrations</Link></Button>}
      />

      <WindowBanner data={data} />

      {data.existingRegistration ? (
        <div role="status" className="bg-brand-indigo/8 flex flex-wrap items-center gap-3 rounded-xl border p-4 text-sm">
          <GraduationCap className="text-brand-indigo size-5 shrink-0" aria-hidden="true" />
          <span>
            You already have registration <strong>{data.existingRegistration.registrationNo}</strong> for this semester
          </span>
          <RegistrationStatusBadge status={data.existingRegistration.status} />
          <Button asChild size="sm" className="ml-auto">
            <Link href={`/student/registration/${data.existingRegistration.id}`}>View registration</Link>
          </Button>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="available-heading" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="available-heading" className="text-base font-semibold">
              Available courses <span className="text-muted-foreground font-normal">({courses.length})</span>
            </h2>
            <div className="relative ml-auto min-w-48 flex-1 sm:max-w-xs">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden="true" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search code or title" aria-label="Search courses" className="h-9 pl-9" />
            </div>
            <select
              aria-label="Filter by course type"
              value={type}
              onChange={(event) => setType(event.target.value as "ALL" | CourseType)}
              className="border-input bg-background h-9 rounded-md border px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <option value="ALL">All types</option>
              {Object.entries(TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {courses.length === 0 ? (
            <EmptyState
              icon={ShoppingBag}
              title={data.courses.length === 0 ? "No courses are offered to you this semester" : "No courses match"}
              description={data.courses.length === 0 ? "Courses appear here once the department opens them for your semester level." : "Try a different search or type."}
            />
          ) : (
            <ul className="space-y-3">
              {courses.map((course) => (
                <li key={course.offeringId}>
                  <CourseRow course={course} checked={selected.includes(course.offeringId)} selectable={canSelect && course.state === "AVAILABLE"} onToggle={() => toggle(course.offeringId)} />
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside id="registration-summary" aria-label="Registration summary" className="lg:sticky lg:top-6 lg:self-start">
          <SectionCard title="Registration summary" description={selected.length === 0 ? "Select courses to see the fee." : `${selected.length} course${selected.length === 1 ? "" : "s"} selected`}>
            {selected.length === 0 ? (
              <p className="text-muted-foreground text-sm">Nothing selected yet. Tick the courses you want to register.</p>
            ) : (
              <div className="space-y-5">
                <ul className="divide-y text-sm">
                  {(summary?.courses ?? selectedCourses.map((c) => ({ offeringId: c.offeringId, courseCode: c.courseCode, title: c.title, courseType: c.courseType, credits: c.credits }))).map((c) => (
                    <li key={c.offeringId} className="flex items-start justify-between gap-3 py-2 first:pt-0">
                      <span className="min-w-0">
                        <span className="font-mono text-xs">{c.courseCode}</span>
                        <span className="block truncate">{c.title}</span>
                      </span>
                      <span className="shrink-0 text-right text-xs">
                        <span className="tabular-nums">{c.credits}</span> cr
                        <span className="text-muted-foreground block capitalize">{TYPE_LABEL[c.courseType].toLowerCase()}</span>
                      </span>
                    </li>
                  ))}
                </ul>

                {summary ? <CreditMeter total={summary.fees.totalCredits} min={summary.limits.minCredits} max={summary.limits.maxCredits} /> : <Skeleton className="h-10 w-full" />}

                {summary ? (
                  <>
                    <FeeBreakdown fees={summary.fees} />
                    {summary.isLate ? <p className="bg-warning/15 rounded-lg px-3 py-2 text-xs">This is late registration, so a late fee applies.</p> : null}
                  </>
                ) : (
                  <Skeleton className="h-32 w-full" />
                )}

                {issues.length > 0 ? (
                  <ul role="alert" className="space-y-2">
                    {issues.map((issue) => (
                      <li key={`${issue.code}-${issue.offeringId ?? "all"}`} className="bg-destructive/10 text-destructive flex gap-2 rounded-lg p-2.5 text-xs">
                        <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <Button
                  className="bg-brand-gradient h-11 w-full text-white hover:opacity-90"
                  disabled={!canSelect || !preview.data?.valid || preview.isFetching || submit.isPending}
                  onClick={() => setConfirming(true)}
                >
                  {preview.isFetching ? (
                    <>
                      <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Checking…
                    </>
                  ) : (
                    "Confirm registration"
                  )}
                </Button>
              </div>
            )}
          </SectionCard>
        </aside>
      </div>

      {selected.length > 0 && canSelect ? (
        <div className="bg-background/95 fixed inset-x-0 bottom-0 z-30 flex items-center gap-3 border-t px-4 py-3 backdrop-blur lg:hidden">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{selected.length} selected</p>
            <p className="text-muted-foreground text-xs tabular-nums">{summary ? formatPaisa(total) : "Calculating…"}</p>
          </div>
          <Button size="sm" onClick={() => document.getElementById("registration-summary")?.scrollIntoView({ behavior: "smooth" })}>
            Review
          </Button>
        </div>
      ) : null}

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit this registration?</AlertDialogTitle>
            <AlertDialogDescription>
              {summary
                ? `${summary.courses.length} course(s), ${summary.fees.totalCredits} credits, total ${formatPaisa(summary.fees.totalAmount)}. Your seats are held while the invoice is unpaid; you pay on the next screen.`
                : "Your seats will be held while the invoice is unpaid."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Review again</AlertDialogCancel>
            <AlertDialogAction
              disabled={submit.isPending}
              onClick={(event) => {
                event.preventDefault();
                submit.mutate(undefined, { onSettled: () => setConfirming(false) });
              }}
            >
              {submit.isPending ? "Submitting…" : "Submit registration"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CourseRow({ course, checked, selectable, onToggle }: { course: AvailableCourse; checked: boolean; selectable: boolean; onToggle: () => void }) {
  const percent = course.seats.max > 0 ? (course.seats.taken / course.seats.max) * 100 : 0;
  return (
    <label
      className={cn(
        "bg-card flex gap-4 rounded-xl border p-4 transition-all",
        selectable ? "hover:border-primary/50 cursor-pointer hover:shadow-sm" : "opacity-75",
        checked && "border-primary bg-primary/[0.04] ring-primary/30 shadow-sm ring-1",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={!selectable}
        onChange={onToggle}
        aria-label={`Select ${course.courseCode} ${course.title}`}
        className="mt-1 size-5 shrink-0 cursor-pointer disabled:cursor-not-allowed"
      />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="font-mono">{course.courseCode}</Badge>
          <Badge variant="secondary">{TYPE_LABEL[course.courseType]}</Badge>
          <CourseStateBadge state={course.state} />
        </div>
        <p className="font-semibold">{course.title}</p>
        <dl className="text-muted-foreground grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
          <div className="flex gap-1"><dt>Credit:</dt><dd className="text-foreground tabular-nums">{course.credits}</dd></div>
          <div className="flex gap-1"><dt>Teacher:</dt><dd className="text-foreground truncate">{course.teacher}</dd></div>
          {course.prerequisite ? (
            <div className="flex gap-1 sm:col-span-2"><dt>Prerequisite:</dt><dd className="text-foreground">{course.prerequisite.courseCode} · {course.prerequisite.title}</dd></div>
          ) : null}
        </dl>
        <div className="flex items-center gap-3">
          <Progress value={percent} aria-label={`${course.seats.taken} of ${course.seats.max} seats taken`} className={cn("h-1.5 max-w-40", percent >= 90 && "[&>div]:bg-destructive")} />
          <span className="text-muted-foreground text-xs tabular-nums">Seats {course.seats.taken}/{course.seats.max}</span>
        </div>
        {course.stateMessage && course.state !== "ALREADY_REGISTERED" ? <p className="text-muted-foreground text-xs">{course.stateMessage}</p> : null}
      </div>
    </label>
  );
}

function CreditMeter({ total, min, max }: { total: number; min: number; max: number }) {
  const out = (min > 0 && total < min) || (max > 0 && total > max);
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">Total credits</span>
        <span className={cn("font-semibold tabular-nums", out && "text-destructive")}>{total}</span>
      </div>
      {max > 0 ? <Progress value={Math.min(100, (total / max) * 100)} aria-label="Credits against the maximum" className={cn(out && "[&>div]:bg-destructive")} /> : null}
      <p className="text-muted-foreground text-xs">{min > 0 ? `Minimum ${min}` : "No minimum"} · {max > 0 ? `Maximum ${max}` : "No maximum"}</p>
    </div>
  );
}

function WindowBanner({ data }: { data: AvailableCourses }) {
  const w = data.window;
  if (!w) return null;
  const late = data.fees?.lateFee ?? 0;
  let text: string;
  switch (w.state) {
    case "OPEN":
      text = w.registrationEnd ? `Registration is open until ${formatDateTime(w.registrationEnd)}.` : "Registration is open.";
      break;
    case "LATE":
      text = `Late registration is open${w.lateEnd ? ` until ${formatDateTime(w.lateEnd)}` : ""}. A late fee of ${formatPaisa(late)} applies.`;
      break;
    case "NOT_OPEN":
      text = w.registrationStart ? `Registration opens ${formatDateTime(w.registrationStart)}.` : "Registration has not opened yet.";
      break;
    case "CLOSED":
      text = w.message ?? "The registration deadline has passed.";
      break;
    default:
      text = w.message ?? "Registration is not open for this semester.";
  }
  return (
    <div role="status" className="bg-card flex flex-wrap items-center gap-3 rounded-xl border p-4 text-sm">
      <WindowStateBadge state={w.state} />
      <span>{text}</span>
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <Skeleton className="h-10 w-72" />
      <Skeleton className="h-14 w-full rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-3">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

