"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "@tanstack/react-form";
import { Pencil, Plus, Users } from "lucide-react";

import { DataTable, type Column } from "@/components/admin/data-table";
import { FormDialog } from "@/components/admin/form-dialog";
import { FormAlert } from "@/components/forms/form-alert";
import { TextInputField } from "@/components/forms/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { apiListRequest, apiRequest } from "@/lib/api/client";
import { toApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";
import { summariseApiError } from "@/lib/forms/server-errors";
import { GRADE_POINTS, resultSchema, type ResultInput } from "@/lib/validations/admin";
import type { CourseOffering, Enrollment, Result } from "@/types/entities";

type Row = { enrollment: Enrollment; result: Result | undefined };

/** Students in one offering, with grade entry. Publishing a result completes that enrolment. */
export function OfferingStudents({ id }: { id: string }) {
  const [editing, setEditing] = useState<Row | null>(null);

  const offering = useApiQuery({
    queryKey: queryKeys.courseOfferings.list({ id }),
    queryFn: () => apiRequest<CourseOffering>(`/course-offerings/${id}`),
  });
  const enrollments = useApiQuery({
    queryKey: queryKeys.enrollments.list({ courseOfferingId: id }),
    queryFn: () => apiListRequest<Enrollment>("/enrollments", { courseOfferingId: id, limit: 100, sortBy: "enrolledAt", sortOrder: "asc" }),
  });
  const results = useApiQuery({
    queryKey: queryKeys.results.list({ courseOfferingId: id }),
    queryFn: () => apiListRequest<Result>("/results", { courseOfferingId: id, limit: 100 }),
  });

  const resultByEnrollment = new Map((results.data?.data ?? []).map((r) => [r.enrollmentId, r]));
  const rows: Row[] = (enrollments.data?.data ?? [])
    .filter((e) => e.status !== "DROPPED")
    .map((enrollment) => ({ enrollment, result: resultByEnrollment.get(enrollment.id) }));

  const columns: Column<Row>[] = [
    { id: "student", header: "Student", cell: (r) => <div className="min-w-0"><p className="truncate font-medium">{r.enrollment.student.name}</p><p className="text-muted-foreground font-mono text-xs">{r.enrollment.student.studentId}</p></div> },
    { id: "status", header: "Enrolment", className: "hidden sm:table-cell", cell: (r) => <Badge variant="secondary">{r.enrollment.status.toLowerCase()}</Badge> },
    {
      id: "grade",
      header: "Result",
      cell: (r) =>
        r.result ? (
          <span className="font-mono text-sm">{r.result.grade} <span className="text-muted-foreground">({r.result.gradePoint.toFixed(2)})</span></span>
        ) : (
          <span className="text-muted-foreground text-sm">Not entered</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
        <Link href="/faculty/offerings" className="hover:text-foreground underline-offset-4 hover:underline">My offerings</Link>
      </nav>

      <PageHeader
        eyebrow={offering.data ? `${offering.data.semester.code} ${offering.data.semester.year}` : "Course"}
        title={offering.data?.course.title ?? "Course offering"}
        description={offering.data ? `${offering.data.course.courseCode} · ${rows.length} student(s)` : undefined}
      />

      <DataTable
        caption="Students in this course"
        columns={columns}
        rows={rows.map((r) => ({ ...r, id: r.enrollment.id }))}
        isLoading={enrollments.isPending}
        isError={enrollments.isError}
        errorMessage={enrollments.error?.message}
        onRetry={() => void enrollments.refetch()}
        emptyIcon={Users}
        emptyTitle="No students enrolled yet"
        emptyDescription="Students appear here once they enrol in this offering."
        rowActions={(r) => (
          <Button variant="outline" size="sm" onClick={() => setEditing(r)} aria-label={`${r.result ? "Edit" : "Enter"} result for ${r.enrollment.student.name}`}>
            {r.result ? <Pencil className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
            {r.result ? "Edit result" : "Enter result"}
          </Button>
        )}
      />

      <FormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing ? `Result for ${editing.enrollment.student.name}` : "Result"}
        description={editing?.result ? "Changes take effect immediately." : "Publishing a result marks this enrolment as completed."}
      >
        {editing ? <ResultForm row={editing} onDone={() => setEditing(null)} offeringId={id} /> : null}
      </FormDialog>
    </div>
  );
}

const gradeOptions = Object.keys(GRADE_POINTS).map((grade) => ({ value: grade, label: grade }));

function ResultForm({ row, offeringId, onDone }: { row: Row; offeringId: string; onDone: () => void }) {
  const [serverError, setServerError] = useState<{ message: string; details: string[] } | null>(null);

  const save = useApiMutation<Result, ResultInput>({
    mutationFn: (values) => {
      const body = { grade: values.grade, gradePoint: Number(values.gradePoint) };
      return row.result
        ? apiRequest<Result>(`/results/${row.result.id}`, { method: "PATCH", body })
        : apiRequest<Result>("/results", { method: "POST", body: { enrollmentId: row.enrollment.id, ...body } });
    },
    notifyError: false,
    successMessage: row.result ? "Result updated." : "Result published.",
    invalidate: [queryKeys.results.all, queryKeys.enrollments.all, queryKeys.courseOfferings.all, queryKeys.courseOfferings.list({ id: offeringId })],
  });

  const form = useForm({
    defaultValues: {
      grade: row.result?.grade ?? "",
      gradePoint: row.result ? String(row.result.gradePoint) : "",
    } as ResultInput,
    validators: { onSubmit: resultSchema },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        await save.mutateAsync(value);
        onDone();
      } catch (error) {
        setServerError(summariseApiError(toApiError(error)));
      }
    },
  });

  return (
    <form noValidate className="space-y-5" onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); void form.handleSubmit(); }}>
      {serverError ? <FormAlert message={serverError.message} details={serverError.details} /> : null}

      <form.Field name="grade">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor="result-grade">Grade</Label>
            <Select
              value={field.state.value}
              onValueChange={(value) => {
                field.handleChange(value);
                // Fill the grade point from the letter. Faculty can still change it.
                form.setFieldValue("gradePoint", String(GRADE_POINTS[value] ?? ""));
              }}
            >
              <SelectTrigger id="result-grade" className="h-10 w-full" aria-invalid={field.state.meta.isTouched && field.state.meta.errors.length > 0}>
                <SelectValue placeholder="Choose a grade" />
              </SelectTrigger>
              <SelectContent>
                {gradeOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {field.state.meta.isTouched && field.state.meta.errors.length > 0 ? (
              <p className="text-destructive text-sm" role="alert">{String(field.state.meta.errors[0] && (typeof field.state.meta.errors[0] === "string" ? field.state.meta.errors[0] : (field.state.meta.errors[0] as { message?: string }).message))}</p>
            ) : null}
          </div>
        )}
      </form.Field>

      <form.Field name="gradePoint">
        {(field) => <TextInputField field={field} label="Grade point" inputMode="decimal" hint="Filled from the grade. Adjust only if the policy differs." />}
      </form.Field>

      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
            <Button type="submit" disabled={!canSubmit || isSubmitting} className="bg-brand-gradient text-white hover:opacity-90">
              {isSubmitting ? "Saving…" : row.result ? "Save result" : "Publish result"}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
