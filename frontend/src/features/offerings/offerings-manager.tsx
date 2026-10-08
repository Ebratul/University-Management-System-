"use client";

import { useState } from "react";
import { CalendarClock, Pencil, Plus, Trash2 } from "lucide-react";
import { useForm } from "@tanstack/react-form";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DataTable, type Column } from "@/components/admin/data-table";
import { FormDialog } from "@/components/admin/form-dialog";
import { ListToolbar, useListSearch } from "@/components/admin/list-toolbar";
import { Pagination } from "@/components/admin/pagination";
import { FormAlert } from "@/components/forms/form-alert";
import { SelectInputField, TextInputField } from "@/components/forms/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { useCourseOptions, useFacultyOptions, useSemesterOptions } from "@/hooks/use-options";
import { useListState } from "@/hooks/use-list-state";
import { apiListRequest, apiRequest } from "@/lib/api/client";
import { toApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";
import { summariseApiError } from "@/lib/forms/server-errors";
import { offeringCreateSchema, offeringUpdateSchema, ordinal, SEMESTER_LEVELS, type OfferingCreateInput, type OfferingUpdateInput } from "@/lib/validations/admin";
import type { CourseOffering } from "@/types/entities";

const FILTER_KEYS = ["semesterId"];

export function OfferingsManager() {
  const list = useListState(FILTER_KEYS);
  const [search, setSearch] = useListSearch();
  const semesters = useSemesterOptions();
  const [dialog, setDialog] = useState<{ item: CourseOffering | null } | null>(null);
  const [toDelete, setToDelete] = useState<CourseOffering | null>(null);

  const offerings = useApiQuery({
    queryKey: queryKeys.courseOfferings.list(list.query),
    queryFn: () => apiListRequest<CourseOffering>("/course-offerings", list.query),
    keepPreviousData: true,
  });

  const remove = useApiMutation({
    mutationFn: (id: string) => apiRequest<null>(`/course-offerings/${id}`, { method: "DELETE" }),
    successMessage: "Offering removed.",
    invalidate: [queryKeys.courseOfferings.all, queryKeys.adminStats],
    onSuccess: () => setToDelete(null),
  });

  const columns: Column<CourseOffering>[] = [
    {
      id: "course",
      header: "Course",
      sortKey: "createdAt",
      cell: (o) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{o.course.title}</p>
          <p className="text-muted-foreground font-mono text-xs">{o.course.courseCode}</p>
        </div>
      ),
    },
    {
      id: "semester",
      header: "Semester",
      className: "hidden md:table-cell",
      cell: (o) => <span>{o.semester.code} {o.semester.year}</span>,
    },
    { id: "faculty", header: "Faculty", className: "hidden lg:table-cell", cell: (o) => <span className="text-muted-foreground">{o.faculty.name}</span> },
    {
      id: "level",
      header: "For",
      className: "hidden xl:table-cell",
      cell: (o) => <span className="text-muted-foreground text-sm">{o.semesterLevel ? `${ordinal(o.semesterLevel)} semester` : "All levels"}</span>,
    },
    {
      id: "registration",
      header: "Registration",
      className: "hidden md:table-cell",
      cell: (o) => (
        <Badge variant={o.registrationEnabled === false ? "outline" : "secondary"}>{o.registrationEnabled === false ? "Closed" : "Open"}</Badge>
      ),
    },
    {
      id: "seats",
      header: "Seats",
      sortKey: "maxSeats",
      cell: (o) => {
        const percent = o.maxSeats > 0 ? (o.enrolledCount / o.maxSeats) * 100 : 0;
        return (
          <div className="w-36 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="tabular-nums">{o.enrolledCount}/{o.maxSeats}</span>
              {o.seatsRemaining <= 0 ? <Badge variant="destructive">Full</Badge> : <span className="text-muted-foreground">{o.seatsRemaining} left</span>}
            </div>
            <Progress value={percent} aria-label={`${Math.round(percent)}% of seats taken`} />
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Academic setup" title="Course offerings" description="A course taught by one faculty member in one semester, with a seat limit." />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchLabel="Search offerings"
        searchPlaceholder="Offerings are filtered by semester"
        filters={
          <select
            aria-label="Filter by semester"
            value={list.filters.semesterId ?? ""}
            onChange={(event) => list.update({ semesterId: event.target.value })}
            className="border-input bg-background h-10 max-w-64 rounded-md border px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">All semesters</option>
            {semesters.options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        }
        action={
          <Button onClick={() => setDialog({ item: null })} className="bg-brand-gradient text-white hover:opacity-90">
            <Plus className="size-4" aria-hidden="true" />
            New offering
          </Button>
        }
      />

      <DataTable
        caption="Course offerings"
        columns={columns}
        rows={offerings.data?.data}
        isLoading={offerings.isPending}
        isError={offerings.isError}
        errorMessage={offerings.error?.message}
        onRetry={() => void offerings.refetch()}
        emptyIcon={CalendarClock}
        emptyTitle="No offerings yet"
        emptyDescription="Offer a course for a semester to open it for enrolment."
        rowActions={(o) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${o.course.courseCode} offering`} onClick={() => setDialog({ item: o })}>
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Remove ${o.course.courseCode} offering`} onClick={() => setToDelete(o)}>
              <Trash2 className="text-destructive size-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      />

      <Pagination meta={offerings.data?.meta} limit={list.limit} onPageChange={(page) => list.update({ page })} onLimitChange={(limit) => list.update({ limit, page: 1 })} />

      <FormDialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)} title={dialog?.item ? "Edit offering" : "New offering"} description="Enrolled students are never removed when you change the seat limit. The limit cannot drop below the current enrolment.">
        {dialog ? (dialog.item ? <OfferingEditForm item={dialog.item} onDone={() => setDialog(null)} /> : <OfferingCreateForm onDone={() => setDialog(null)} />) : null}
      </FormDialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Remove ${toDelete?.course.courseCode ?? "offering"}?`}
        description={`The offering is hidden. ${toDelete?.enrolledCount ?? 0} enrolment(s) stay on record, but students can no longer enrol here.`}
        confirmLabel="Remove offering"
        pending={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </div>
  );
}

function OfferingCreateForm({ onDone }: { onDone: () => void }) {
  const [serverError, setServerError] = useState<{ message: string; details: string[] } | null>(null);
  const courses = useCourseOptions();
  const faculties = useFacultyOptions();
  const semesters = useSemesterOptions();

  const create = useApiMutation<CourseOffering, OfferingCreateInput>({
    mutationFn: (values) =>
      apiRequest<CourseOffering>("/course-offerings", {
        method: "POST",
        body: {
          courseId: values.courseId,
          facultyId: values.facultyId,
          semesterId: values.semesterId,
          ...(values.maxSeats.trim() ? { maxSeats: Number(values.maxSeats) } : {}),
          semesterLevel: toLevel(values.semesterLevel),
          registrationEnabled: values.registrationEnabled,
        },
      }),
    notifyError: false,
    successMessage: "Offering created.",
    invalidate: [queryKeys.courseOfferings.all, queryKeys.adminStats],
  });

  const form = useForm({
    defaultValues: { courseId: "", facultyId: "", semesterId: "", maxSeats: "", semesterLevel: "all", registrationEnabled: true },
    validators: { onSubmit: offeringCreateSchema },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        await create.mutateAsync(value);
        onDone();
      } catch (error) {
        setServerError(summariseApiError(toApiError(error)));
      }
    },
  });

  return (
    <form noValidate className="space-y-5" onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); void form.handleSubmit(); }}>
      {serverError ? <FormAlert message={serverError.message} details={serverError.details} /> : null}
      <form.Field name="courseId">{(field) => <SelectInputField field={field} label="Course" placeholder={courses.isLoading ? "Loading courses…" : "Choose a course"} options={courses.options} disabled={courses.isLoading} />}</form.Field>
      <form.Field name="semesterId">{(field) => <SelectInputField field={field} label="Semester" placeholder={semesters.isLoading ? "Loading semesters…" : "Choose a semester"} options={semesters.options} disabled={semesters.isLoading} />}</form.Field>
      <form.Field name="facultyId">{(field) => <SelectInputField field={field} label="Teaching faculty" placeholder={faculties.isLoading ? "Loading faculty…" : "Choose a faculty member"} options={faculties.options} disabled={faculties.isLoading} />}</form.Field>
      <form.Field name="maxSeats">{(field) => <TextInputField field={field} label="Seats (optional)" inputMode="numeric" placeholder="40" hint="Leave blank for the default of 40." />}</form.Field>
      <form.Field name="semesterLevel">
        {(field) => <SelectInputField field={field} label="Offered to" placeholder="Choose a semester level" options={LEVEL_OPTIONS} hint="Students see it only when they are in this semester level of the course's department." />}
      </form.Field>
      <form.Field name="registrationEnabled">{(field) => <RegistrationSwitch checked={field.state.value} onChange={field.handleChange} />}</form.Field>
      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
            <Button type="submit" disabled={!canSubmit || isSubmitting} className="bg-brand-gradient text-white hover:opacity-90">
              {isSubmitting ? "Saving…" : "Create offering"}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}

function OfferingEditForm({ item, onDone }: { item: CourseOffering; onDone: () => void }) {
  const [serverError, setServerError] = useState<{ message: string; details: string[] } | null>(null);
  const faculties = useFacultyOptions();

  const update = useApiMutation<CourseOffering, OfferingUpdateInput>({
    mutationFn: async (values) => {
      const updated = await apiRequest<CourseOffering>(`/course-offerings/${item.id}`, {
        method: "PATCH",
        body: {
          maxSeats: Number(values.maxSeats),
          semesterLevel: toLevel(values.semesterLevel),
          registrationEnabled: values.registrationEnabled,
        },
      });
      if (values.facultyId !== item.faculty.id) {
        await apiRequest(`/course-offerings/${item.id}/assign-faculty`, { method: "POST", body: { facultyId: values.facultyId } });
      }
      return updated;
    },
    notifyError: false,
    successMessage: "Offering updated.",
    invalidate: [queryKeys.courseOfferings.all, queryKeys.adminStats],
  });

  const form = useForm({
    defaultValues: {
      maxSeats: String(item.maxSeats),
      facultyId: item.faculty.id,
      semesterLevel: item.semesterLevel ? String(item.semesterLevel) : "all",
      registrationEnabled: item.registrationEnabled !== false,
    },
    validators: { onSubmit: offeringUpdateSchema },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        await update.mutateAsync(value);
        onDone();
      } catch (error) {
        setServerError(summariseApiError(toApiError(error)));
      }
    },
  });

  return (
    <form noValidate className="space-y-5" onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); void form.handleSubmit(); }}>
      {serverError ? <FormAlert message={serverError.message} details={serverError.details} /> : null}
      <p className="text-muted-foreground text-sm">
        <span className="text-foreground font-medium">{item.course.title}</span> · {item.semester.code} {item.semester.year} · {item.enrolledCount} enrolled
      </p>
      <form.Field name="maxSeats">{(field) => <TextInputField field={field} label="Seats" inputMode="numeric" />}</form.Field>
      <form.Field name="facultyId">{(field) => <SelectInputField field={field} label="Teaching faculty" placeholder="Choose a faculty member" options={faculties.options} disabled={faculties.isLoading} />}</form.Field>
      <form.Field name="semesterLevel">
        {(field) => <SelectInputField field={field} label="Offered to" placeholder="Choose a semester level" options={LEVEL_OPTIONS} />}
      </form.Field>
      <form.Field name="registrationEnabled">{(field) => <RegistrationSwitch checked={field.state.value} onChange={field.handleChange} />}</form.Field>
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

const LEVEL_OPTIONS = [
  { value: "all", label: "All levels" },
  ...SEMESTER_LEVELS.map((level) => ({ value: level, label: `${ordinal(Number(level))} semester` })),
];

/** "Open for course registration" switch. Closed offerings are hidden from students. */
function RegistrationSwitch({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 text-sm">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 size-4" />
      <span>
        <span className="font-medium">Open for course registration</span>
        <span className="text-muted-foreground block text-xs">Students of the right department and semester level can pick it. Turn off to hide it without deleting.</span>
      </span>
    </label>
  );
}

const toLevel = (value: string) => (value === "all" ? null : Number(value));
