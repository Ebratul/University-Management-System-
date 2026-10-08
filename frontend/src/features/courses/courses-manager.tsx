"use client";

import { useState } from "react";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { useForm } from "@tanstack/react-form";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DataTable, type Column } from "@/components/admin/data-table";
import { FormDialog } from "@/components/admin/form-dialog";
import { ListToolbar, useListSearch } from "@/components/admin/list-toolbar";
import { Pagination } from "@/components/admin/pagination";
import { FormAlert } from "@/components/forms/form-alert";
import { SelectInputField, TextareaField, TextInputField } from "@/components/forms/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCourseOptions, useDepartmentOptions } from "@/hooks/use-options";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { useListState } from "@/hooks/use-list-state";
import { apiListRequest, apiRequest } from "@/lib/api/client";
import { toApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";
import { summariseApiError } from "@/lib/forms/server-errors";
import { COURSE_TYPE_OPTIONS, courseSchema, type CourseInput } from "@/lib/validations/admin";
import type { Course } from "@/types/entities";

const FILTER_KEYS = ["departmentId"];

export function CoursesManager() {
  const list = useListState(FILTER_KEYS);
  const [search, setSearch] = useListSearch();
  const departments = useDepartmentOptions();
  const [dialog, setDialog] = useState<{ item: Course | null } | null>(null);
  const [toDelete, setToDelete] = useState<Course | null>(null);

  const courses = useApiQuery({
    queryKey: queryKeys.courses.list(list.query),
    queryFn: () => apiListRequest<Course>("/courses", list.query),
    keepPreviousData: true,
  });

  const remove = useApiMutation({
    mutationFn: (id: string) => apiRequest<null>(`/courses/${id}`, { method: "DELETE" }),
    successMessage: "Course deleted.",
    invalidate: [queryKeys.courses.all, queryKeys.courseOfferings.all, queryKeys.adminStats],
    onSuccess: () => setToDelete(null),
  });

  const columns: Column<Course>[] = [
    { id: "code", header: "Code", sortKey: "courseCode", cell: (c) => <Badge variant="outline" className="font-mono">{c.courseCode}</Badge> },
    { id: "title", header: "Title", sortKey: "title", cell: (c) => <span className="font-medium">{c.title}</span> },
    { id: "credits", header: "Credits", sortKey: "credits", className: "hidden sm:table-cell", cell: (c) => <span className="tabular-nums">{c.credits}</span> },
    {
      id: "type",
      header: "Type",
      className: "hidden md:table-cell",
      cell: (c) => <Badge variant="secondary" className="capitalize">{(c.courseType ?? "THEORY").toLowerCase()}</Badge>,
    },
    {
      id: "prerequisite",
      header: "Prerequisite",
      className: "hidden lg:table-cell",
      cell: (c) => (c.prerequisite ? <span className="font-mono text-xs">{c.prerequisite.courseCode}</span> : <span className="text-muted-foreground">—</span>),
    },
    { id: "department", header: "Department", className: "hidden md:table-cell", cell: (c) => <span className="text-muted-foreground">{c.department.name}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Academic setup" title="Courses" description="The catalogue of courses, each owned by one department." />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchLabel="Search courses"
        searchPlaceholder="Search by title or code"
        filters={
          <select
            aria-label="Filter by department"
            value={list.filters.departmentId ?? ""}
            onChange={(event) => list.update({ departmentId: event.target.value })}
            className="border-input bg-background h-10 max-w-64 rounded-md border px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">All departments</option>
            {departments.options.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        }
        action={
          <Button onClick={() => setDialog({ item: null })} className="bg-brand-gradient text-white hover:opacity-90">
            <Plus className="size-4" aria-hidden="true" />
            New course
          </Button>
        }
      />

      <DataTable
        caption="Courses"
        columns={columns}
        rows={courses.data?.data}
        isLoading={courses.isPending}
        isError={courses.isError}
        errorMessage={courses.error?.message}
        onRetry={() => void courses.refetch()}
        sortBy={list.sortBy ?? "courseCode"}
        sortOrder={list.sortOrder ?? "asc"}
        onSort={(sortKey, order) => list.update({ sortBy: sortKey, sortOrder: order, page: 1 })}
        emptyIcon={BookOpen}
        emptyTitle="No courses match"
        emptyDescription="Add a course, then schedule it as an offering for a semester."
        rowActions={(c) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${c.courseCode}`} onClick={() => setDialog({ item: c })}>
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Delete ${c.courseCode}`} onClick={() => setToDelete(c)}>
              <Trash2 className="text-destructive size-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      />

      <Pagination meta={courses.data?.meta} limit={list.limit} onPageChange={(page) => list.update({ page })} onLimitChange={(limit) => list.update({ limit, page: 1 })} />

      <FormDialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)} title={dialog?.item ? "Edit course" : "New course"}>
        {dialog ? <CourseForm item={dialog.item} departments={departments.options} onDone={() => setDialog(null)} /> : null}
      </FormDialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Delete ${toDelete?.courseCode ?? "course"}?`}
        description="The course is hidden from the catalogue. Offerings that use it are removed from the public list too."
        confirmLabel="Delete course"
        pending={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </div>
  );
}

function CourseForm({ item, departments, onDone }: { item: Course | null; departments: { value: string; label: string }[]; onDone: () => void }) {
  const [serverError, setServerError] = useState<{ message: string; details: string[] } | null>(null);
  const courseOptions = useCourseOptions();
  // A course cannot be its own prerequisite.
  const prerequisites = courseOptions.options.filter((option) => option.value !== item?.id);

  const save = useApiMutation<Course, CourseInput>({
    mutationFn: (values) => {
      const body = {
        courseCode: values.courseCode,
        title: values.title,
        departmentId: values.departmentId,
        credits: Number(values.credits),
        courseType: values.courseType,
        // "" = no prerequisite. null clears an existing one on edit.
        prerequisiteId: values.prerequisiteId && values.prerequisiteId !== "none" ? values.prerequisiteId : item ? null : undefined,
        ...(values.description !== undefined ? { description: values.description } : {}),
      };
      return item
        ? apiRequest<Course>(`/courses/${item.id}`, { method: "PATCH", body })
        : apiRequest<Course>("/courses", { method: "POST", body });
    },
    notifyError: false,
    successMessage: item ? "Course updated." : "Course created.",
    invalidate: [queryKeys.courses.all, queryKeys.courseOfferings.all, queryKeys.adminStats],
  });

  const form = useForm({
    defaultValues: {
      courseCode: item?.courseCode ?? "",
      title: item?.title ?? "",
      credits: item ? String(item.credits) : "3",
      departmentId: item?.departmentId ?? "",
      courseType: item?.courseType ?? ("THEORY" as const),
      prerequisiteId: item?.prerequisiteId ?? "",
      description: item?.description ?? "",
    },
    validators: { onSubmit: courseSchema },
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

      <form.Field name="courseCode">{(field) => <TextInputField field={field} label="Course code" placeholder="CSE1010" />}</form.Field>
      <form.Field name="title">{(field) => <TextInputField field={field} label="Title" placeholder="Introduction to Programming" />}</form.Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <form.Field name="credits">{(field) => <TextInputField field={field} label="Credits" inputMode="decimal" hint="Whole or half credits, e.g. 3 or 1.5." />}</form.Field>
        <form.Field name="departmentId">
          {(field) => <SelectInputField field={field} label="Department" placeholder="Choose a department" options={departments} />}
        </form.Field>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <form.Field name="courseType">
          {(field) => <SelectInputField field={field} label="Course type" placeholder="Choose a type" options={COURSE_TYPE_OPTIONS} hint="Sets which credit-fee rate applies." />}
        </form.Field>
        <form.Field name="prerequisiteId">
          {(field) => <SelectInputField field={field} label="Prerequisite (optional)" placeholder="None" options={[{ value: "none", label: "None" }, ...prerequisites]} />}
        </form.Field>
      </div>
      <form.Field name="description">{(field) => <TextareaField field={field} label="Description (optional)" rows={3} />}</form.Field>

      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
            <Button type="submit" disabled={!canSubmit || isSubmitting} className="bg-brand-gradient text-white hover:opacity-90">
              {isSubmitting ? "Saving…" : item ? "Save changes" : "Create course"}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
