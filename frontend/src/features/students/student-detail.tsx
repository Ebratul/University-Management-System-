"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "@tanstack/react-form";
import { CreditCard as CardIcon, Pencil } from "lucide-react";

import { DataTable, type Column } from "@/components/admin/data-table";
import { FormDialog } from "@/components/admin/form-dialog";
import { FormAlert } from "@/components/forms/form-alert";
import { SelectInputField, TextInputField } from "@/components/forms/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { useDepartmentOptions } from "@/hooks/use-options";
import { apiListRequest, apiRequest } from "@/lib/api/client";
import { toApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";
import { formatDate } from "@/lib/format";
import { summariseApiError } from "@/lib/forms/server-errors";
import { emptyToUndefined, ordinal, SEMESTER_LEVELS, studentUpdateSchema, type StudentUpdateInput } from "@/lib/validations/admin";
import type { Enrollment, Payment, StudentRecord } from "@/types/entities";

const money = new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", maximumFractionDigits: 0 });

export function StudentDetail({ id }: { id: string }) {
  const [editing, setEditing] = useState(false);

  const student = useApiQuery({
    queryKey: queryKeys.students.detail(id),
    queryFn: () => apiRequest<StudentRecord>(`/students/${id}`),
  });
  const enrollments = useApiQuery({
    queryKey: queryKeys.enrollments.list({ studentId: id, limit: 50 }),
    queryFn: () => apiListRequest<Enrollment>("/enrollments", { studentId: id, limit: 50, sortBy: "enrolledAt", sortOrder: "desc" }),
  });
  const payments = useApiQuery({
    queryKey: queryKeys.payments.list({ studentId: id, limit: 50 }),
    queryFn: () => apiListRequest<Payment>("/payments", { studentId: id, limit: 50, sortBy: "createdAt", sortOrder: "desc" }),
  });

  if (student.isPending) return <Skeleton className="h-72 w-full rounded-xl" />;
  if (student.isError) {
    return (
      <div role="alert" className="bg-destructive/10 text-destructive rounded-xl p-5 text-sm">
        {student.error.message}
      </div>
    );
  }

  const s = student.data;
  const enrollmentColumns: Column<Enrollment>[] = [
    { id: "course", header: "Course", cell: (e) => <span className="font-medium">{e.courseOffering.course.title}</span> },
    { id: "code", header: "Code", className: "hidden sm:table-cell", cell: (e) => <span className="font-mono text-xs">{e.courseOffering.course.courseCode}</span> },
    { id: "status", header: "Status", cell: (e) => <Badge variant="secondary">{e.status.toLowerCase()}</Badge> },
  ];
  const paymentColumns: Column<Payment>[] = [
    { id: "semester", header: "Semester", cell: (p) => <span>{p.semester.code} {p.semester.year}</span> },
    { id: "amount", header: "Amount", cell: (p) => <span className="tabular-nums">{money.format(p.amount)}</span> },
    { id: "status", header: "Status", cell: (p) => <Badge variant={p.status === "PAID" ? "default" : p.status === "FAILED" ? "destructive" : "secondary"}>{p.status.toLowerCase()}</Badge> },
    { id: "date", header: "Date", className: "hidden sm:table-cell", cell: (p) => <span className="text-muted-foreground">{formatDate(p.createdAt)}</span> },
  ];

  return (
    <div className="space-y-8">
      <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
        <Link href="/admin/students" className="hover:text-foreground underline-offset-4 hover:underline">Students</Link>
        <span aria-hidden="true"> / </span>
        <span className="text-foreground">{s.name}</span>
      </nav>

      <PageHeader
        eyebrow={`${s.registrationNumber} · ${s.studentId}`}
        title={s.name}
        description={`${s.department.name} · admitted ${s.admissionSemester.code} ${s.admissionSemester.year}`}
        actions={
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="size-4" aria-hidden="true" />
            Edit profile
          </Button>
        }
      />

      <div className="flex items-center gap-4">
        <PersonAvatar name={s.name} imageUrl={s.user?.imageUrl} className="size-20" />
        <div className="text-sm">
          <p className="text-muted-foreground">Registration number</p>
          <p className="font-mono text-base font-semibold">{s.registrationNumber}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader><CardDescription>Phone</CardDescription><CardTitle className="text-base">{s.phone ?? "Not given"}</CardTitle></CardHeader>
        </Card>
        <Card>
          <CardHeader><CardDescription>Date of birth</CardDescription><CardTitle className="text-base">{s.dateOfBirth ? formatDate(s.dateOfBirth) : "Not given"}</CardTitle></CardHeader>
        </Card>
        <Card>
          <CardHeader><CardDescription>Semester level</CardDescription><CardTitle className="text-base">{s.currentSemesterLevel ? `${ordinal(s.currentSemesterLevel)} semester` : "—"}</CardTitle></CardHeader>
        </Card>
        <Card>
          <CardHeader><CardDescription>Enrolments</CardDescription><CardTitle className="text-base">{enrollments.data?.meta.total ?? "—"}</CardTitle></CardHeader>
        </Card>
      </div>

      <section aria-labelledby="enrol-heading" className="space-y-3">
        <h2 id="enrol-heading" className="text-lg font-semibold tracking-tight">Enrolments</h2>
        <DataTable caption="Enrolments for this student" columns={enrollmentColumns} rows={enrollments.data?.data} isLoading={enrollments.isPending} isError={enrollments.isError} errorMessage={enrollments.error?.message} emptyIcon={CardIcon} emptyTitle="Not enrolled in any course yet" />
      </section>

      <section aria-labelledby="pay-heading" className="space-y-3">
        <h2 id="pay-heading" className="text-lg font-semibold tracking-tight">Payments</h2>
        <DataTable caption="Payments for this student" columns={paymentColumns} rows={payments.data?.data} isLoading={payments.isPending} isError={payments.isError} errorMessage={payments.error?.message} emptyIcon={CardIcon} emptyTitle="No payments yet" />
      </section>

      <FormDialog open={editing} onOpenChange={setEditing} title="Edit student profile" description="Login email and student ID cannot be changed here.">
        {editing ? <StudentEditForm student={s} onDone={() => setEditing(false)} /> : null}
      </FormDialog>
    </div>
  );
}


function StudentEditForm({ student, onDone }: { student: StudentRecord; onDone: () => void }) {
  const [serverError, setServerError] = useState<{ message: string; details: string[] } | null>(null);
  const departments = useDepartmentOptions();

  const save = useApiMutation<StudentRecord, StudentUpdateInput>({
    mutationFn: (values) =>
      apiRequest<StudentRecord>(`/students/${student.id}`, {
        method: "PATCH",
        body: {
          name: values.name,
          departmentId: values.departmentId,
          currentSemesterLevel: Number(values.currentSemesterLevel),
          phone: emptyToUndefined(values.phone),
          ...(values.dateOfBirth ? { dateOfBirth: values.dateOfBirth } : {}),
        },
      }),
    notifyError: false,
    successMessage: "Student profile updated.",
    invalidate: [queryKeys.students.all, queryKeys.students.detail(student.id)],
  });

  const form = useForm({
    defaultValues: {
      name: student.name,
      phone: student.phone ?? "",
      dateOfBirth: student.dateOfBirth ? student.dateOfBirth.slice(0, 10) : "",
      departmentId: student.departmentId,
      currentSemesterLevel: String(student.currentSemesterLevel ?? 1),
    },
    validators: { onSubmit: studentUpdateSchema },
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
      <form.Field name="name">{(field) => <TextInputField field={field} label="Full name" />}</form.Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <form.Field name="phone">{(field) => <TextInputField field={field} label="Phone (optional)" type="tel" />}</form.Field>
        <form.Field name="dateOfBirth">{(field) => <TextInputField field={field} label="Date of birth (optional)" type="date" />}</form.Field>
      </div>
      <form.Field name="departmentId">{(field) => <SelectInputField field={field} label="Department" placeholder="Choose a department" options={departments.options} disabled={departments.isLoading} />}</form.Field>
      <form.Field name="currentSemesterLevel">
        {(field) => (
          <SelectInputField
            field={field}
            label="Current semester level"
            placeholder="Choose a level"
            options={SEMESTER_LEVELS.map((level) => ({ value: level, label: `${ordinal(Number(level))} semester` }))}
            hint="Decides which courses the student can register. Advance it each semester."
          />
        )}
      </form.Field>
      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
            <Button type="submit" disabled={!canSubmit || isSubmitting} className="bg-brand-gradient text-white hover:opacity-90">
              {isSubmitting ? "Saving…" : "Save changes"}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
