"use client";

import { useState } from "react";
import { BookOpenCheck, Check, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { DataTable, type Column } from "@/components/admin/data-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApiQuery } from "@/hooks/use-api-query";
import { useListState } from "@/hooks/use-list-state";
import { useSemesterOptions } from "@/hooks/use-options";
import { apiListRequest, apiRequest } from "@/lib/api/client";
import { toApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";
import type { PaginatedResult } from "@/types/api";
import type { CourseOffering, Enrollment } from "@/types/entities";

const FILTER_KEYS = ["semesterId"];

/** Offerings for one semester, with enrolment that updates the seat count before the server answers. */
export function CourseEnrolment() {
  const list = useListState(FILTER_KEYS);
  const queryClient = useQueryClient();
  const semesters = useSemesterOptions();
  const [pendingId, setPendingId] = useState<string | null>(null);

  // Default to the ongoing semester, or the next one, when none is chosen.
  const defaultSemester =
    semesters.semesters.find((s) => s.status === "ONGOING") ?? semesters.semesters.find((s) => s.status === "UPCOMING");
  const semesterId = list.filters.semesterId ?? defaultSemester?.id;

  const offeringsQuery = { semesterId, limit: 100, sortBy: "createdAt", sortOrder: "asc" as const };
  const offeringsKey = queryKeys.courseOfferings.list(offeringsQuery);

  const offerings = useApiQuery({
    queryKey: offeringsKey,
    queryFn: () => apiListRequest<CourseOffering>("/course-offerings", offeringsQuery),
    enabled: Boolean(semesterId),
    keepPreviousData: true,
  });

  const mine = useApiQuery({
    queryKey: queryKeys.enrollments.list({ mine: true }),
    queryFn: () => apiListRequest<Enrollment>("/enrollments", { limit: 100 }),
  });

  const enrolledOfferingIds = new Set(
    (mine.data?.data ?? []).filter((e) => e.status !== "DROPPED").map((e) => e.courseOfferingId),
  );

  const enrol = useMutation<Enrollment, Error, CourseOffering, { previous?: PaginatedResult<CourseOffering> }>({
    mutationFn: (offering) => apiRequest<Enrollment>("/enrollments", { method: "POST", body: { courseOfferingId: offering.id } }),
    onMutate: async (offering) => {
      setPendingId(offering.id);
      await queryClient.cancelQueries({ queryKey: offeringsKey });
      const previous = queryClient.getQueryData<PaginatedResult<CourseOffering>>(offeringsKey);
      queryClient.setQueryData<PaginatedResult<CourseOffering>>(offeringsKey, (old) =>
        old && {
          ...old,
          data: old.data.map((o) =>
            o.id === offering.id ? { ...o, enrolledCount: o.enrolledCount + 1, seatsRemaining: o.seatsRemaining - 1 } : o,
          ),
        },
      );
      return { previous };
    },
    onError: (error, _offering, context) => {
      if (context?.previous) queryClient.setQueryData(offeringsKey, context.previous);
      toast.error(toApiError(error).message);
    },
    onSuccess: (_enrollment, offering) => toast.success(`Enrolled in ${offering.course.title}.`),
    onSettled: () => {
      setPendingId(null);
      void queryClient.invalidateQueries({ queryKey: offeringsKey });
      void queryClient.invalidateQueries({ queryKey: queryKeys.enrollments.all });
    },
  });

  const columns: Column<CourseOffering>[] = [
    {
      id: "course",
      header: "Course",
      cell: (o) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{o.course.title}</p>
          <p className="text-muted-foreground font-mono text-xs">{o.course.courseCode} · {o.course.credits} credits</p>
        </div>
      ),
    },
    { id: "faculty", header: "Faculty", className: "hidden md:table-cell", cell: (o) => <span className="text-muted-foreground">{o.faculty.name}</span> },
    {
      id: "seats",
      header: "Seats",
      cell: (o) => (o.seatsRemaining <= 0 ? <Badge variant="destructive">Full</Badge> : <span className="tabular-nums">{o.seatsRemaining} of {o.maxSeats} free</span>),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full max-w-xs space-y-2">
          <Label htmlFor="enrol-semester">Semester</Label>
          <Select value={semesterId ?? ""} onValueChange={(value) => list.update({ semesterId: value })} disabled={semesters.isLoading}>
            <SelectTrigger id="enrol-semester" className="h-10 w-full">
              <SelectValue placeholder={semesters.isLoading ? "Loading…" : "Choose a semester"} />
            </SelectTrigger>
            <SelectContent>
              {semesters.options.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-muted-foreground text-sm">Seats update as you enrol. A full course cannot be selected.</p>
      </div>

      <DataTable
        caption="Course offerings for the selected semester"
        columns={columns}
        rows={offerings.data?.data}
        isLoading={offerings.isPending && Boolean(semesterId)}
        isError={offerings.isError}
        errorMessage={offerings.error?.message}
        onRetry={() => void offerings.refetch()}
        emptyIcon={BookOpenCheck}
        emptyTitle={semesterId ? "No courses offered this semester" : "Choose a semester"}
        emptyDescription="Offerings appear here once the university has scheduled them."
        rowActions={(o) => {
          if (enrolledOfferingIds.has(o.id)) {
            return (
              <span className="text-primary inline-flex items-center gap-1 text-sm font-medium">
                <Check className="size-4" aria-hidden="true" />
                Enrolled
              </span>
            );
          }
          const full = o.seatsRemaining <= 0;
          // Wait until we know what the student already has, so a repeat click can't send a duplicate.
          return (
            <Button size="sm" disabled={full || enrol.isPending || mine.isPending} onClick={() => enrol.mutate(o)} aria-label={`Enrol in ${o.course.title}`} className="bg-brand-gradient text-white hover:opacity-90">
              {pendingId === o.id ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              {full ? "Full" : "Enrol"}
            </Button>
          );
        }}
      />
    </div>
  );
}
