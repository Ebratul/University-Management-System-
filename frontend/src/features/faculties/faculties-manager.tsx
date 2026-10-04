"use client";

import { useState } from "react";
import { GraduationCap, Pencil, Plus, Trash2 } from "lucide-react";
import { useForm } from "@tanstack/react-form";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DataTable, type Column } from "@/components/admin/data-table";
import { FormDialog } from "@/components/admin/form-dialog";
import { ListToolbar, useListSearch } from "@/components/admin/list-toolbar";
import { Pagination } from "@/components/admin/pagination";
import { FormAlert } from "@/components/forms/form-alert";
import { SelectInputField, TextInputField } from "@/components/forms/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { useDepartmentOptions } from "@/hooks/use-options";
import { useListState } from "@/hooks/use-list-state";
import { apiListRequest, apiRequest } from "@/lib/api/client";
import { toApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";
import { summariseApiError } from "@/lib/forms/server-errors";
import {
  facultyCreateSchema,
  facultyUpdateSchema,
  emptyToUndefined,
  type FacultyCreateInput,
  type FacultyUpdateInput,
} from "@/lib/validations/admin";
import type { Faculty } from "@/types/entities";

const FILTER_KEYS = ["departmentId"];

export function FacultiesManager() {
  const list = useListState(FILTER_KEYS);
  const [search, setSearch] = useListSearch();
  const departments = useDepartmentOptions();
  const [dialog, setDialog] = useState<{ item: Faculty | null } | null>(null);
  const [toDelete, setToDelete] = useState<Faculty | null>(null);

  const faculties = useApiQuery({
    queryKey: queryKeys.faculties.list(list.query),
    queryFn: () => apiListRequest<Faculty>("/faculties", list.query),
    keepPreviousData: true,
  });

  const remove = useApiMutation({
    mutationFn: (id: string) => apiRequest<null>(`/faculties/${id}`, { method: "DELETE" }),
    successMessage: "Faculty member removed.",
    invalidate: [queryKeys.faculties.all, queryKeys.courseOfferings.all, queryKeys.users.all, queryKeys.adminStats],
    onSuccess: () => setToDelete(null),
  });

  const columns: Column<Faculty>[] = [
    { id: "name", header: "Name", sortKey: "name", cell: (f) => <span className="font-medium">{f.name}</span> },
    { id: "facultyId", header: "Faculty ID", sortKey: "facultyId", className: "hidden sm:table-cell", cell: (f) => <span className="font-mono text-xs">{f.facultyId}</span> },
    { id: "designation", header: "Designation", sortKey: "designation", className: "hidden md:table-cell", cell: (f) => <span className="text-muted-foreground">{f.designation}</span> },
    { id: "department", header: "Department", cell: (f) => f.department.name },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="People" title="Faculty" description="Teaching staff. Creating a faculty member also creates their login." />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchLabel="Search faculty"
        searchPlaceholder="Search by name or faculty ID"
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
            Add faculty
          </Button>
        }
      />

      <DataTable
        caption="Faculty members"
        columns={columns}
        rows={faculties.data?.data}
        isLoading={faculties.isPending}
        isError={faculties.isError}
        errorMessage={faculties.error?.message}
        onRetry={() => void faculties.refetch()}
        sortBy={list.sortBy ?? "name"}
        sortOrder={list.sortOrder ?? "asc"}
        onSort={(sortKey, order) => list.update({ sortBy: sortKey, sortOrder: order, page: 1 })}
        emptyIcon={GraduationCap}
        emptyTitle="No faculty match"
        emptyDescription="Add a faculty member to assign them to course offerings."
        rowActions={(f) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${f.name}`} onClick={() => setDialog({ item: f })}>
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Remove ${f.name}`} onClick={() => setToDelete(f)}>
              <Trash2 className="text-destructive size-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      />

      <Pagination meta={faculties.data?.meta} limit={list.limit} onPageChange={(page) => list.update({ page })} onLimitChange={(limit) => list.update({ limit, page: 1 })} />

      <FormDialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)} title={dialog?.item ? "Edit faculty member" : "Add faculty member"}>
        {dialog ? (
          dialog.item ? (
            <FacultyEditForm item={dialog.item} departments={departments.options} onDone={() => setDialog(null)} />
          ) : (
            <FacultyCreateForm departments={departments.options} onDone={() => setDialog(null)} />
          )
        ) : null}
      </FormDialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Remove ${toDelete?.name ?? "faculty member"}?`}
        description="Their login is disabled and they are removed from the directory. Course offerings they teach must be reassigned first."
        confirmLabel="Remove faculty"
        pending={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </div>
  );
}

const departmentField = "departmentId";

function FacultyCreateForm({ departments, onDone }: { departments: { value: string; label: string }[]; onDone: () => void }) {
  const [serverError, setServerError] = useState<{ message: string; details: string[] } | null>(null);

  const create = useApiMutation<Faculty, FacultyCreateInput>({
    mutationFn: (values) =>
      apiRequest<Faculty>("/faculties", {
        method: "POST",
        body: {
          name: values.name,
          email: values.email,
          password: values.password,
          departmentId: values.departmentId,
          phone: emptyToUndefined(values.phone),
          designation: emptyToUndefined(values.designation),
        },
      }),
    notifyError: false,
    successMessage: "Faculty member added.",
    invalidate: [queryKeys.faculties.all, queryKeys.users.all, queryKeys.adminStats],
  });

  const form = useForm({
    defaultValues: { name: "", email: "", password: "", phone: "", designation: "", departmentId: "" },
    validators: { onSubmit: facultyCreateSchema },
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
      <form.Field name="name">{(field) => <TextInputField field={field} label="Full name" />}</form.Field>
      <form.Field name="email">{(field) => <TextInputField field={field} label="Email" type="email" autoComplete="off" />}</form.Field>
      <form.Field name="password">{(field) => <TextInputField field={field} label="Temporary password" type="password" autoComplete="new-password" hint="8+ characters with upper, lower, number and symbol. Share it securely." />}</form.Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <form.Field name="phone">{(field) => <TextInputField field={field} label="Phone (optional)" type="tel" />}</form.Field>
        <form.Field name="designation">{(field) => <TextInputField field={field} label="Designation (optional)" placeholder="Lecturer" />}</form.Field>
      </div>
      <form.Field name={departmentField}>
        {(field) => <SelectInputField field={field} label="Department" placeholder="Choose a department" options={departments} />}
      </form.Field>
      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
            <Button type="submit" disabled={!canSubmit || isSubmitting} className="bg-brand-gradient text-white hover:opacity-90">
              {isSubmitting ? "Saving…" : "Add faculty member"}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}

function FacultyEditForm({ item, departments, onDone }: { item: Faculty; departments: { value: string; label: string }[]; onDone: () => void }) {
  const [serverError, setServerError] = useState<{ message: string; details: string[] } | null>(null);

  const update = useApiMutation<Faculty, FacultyUpdateInput>({
    mutationFn: (values) =>
      apiRequest<Faculty>(`/faculties/${item.id}`, {
        method: "PATCH",
        body: {
          name: values.name,
          departmentId: values.departmentId,
          phone: emptyToUndefined(values.phone),
          designation: emptyToUndefined(values.designation),
        },
      }),
    notifyError: false,
    successMessage: "Faculty member updated.",
    invalidate: [queryKeys.faculties.all, queryKeys.courseOfferings.all, queryKeys.adminStats],
  });

  const form = useForm({
    defaultValues: { name: item.name, phone: item.phone ?? "", designation: item.designation, departmentId: item.departmentId },
    validators: { onSubmit: facultyUpdateSchema },
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
      <p className="text-muted-foreground text-sm">Faculty ID <span className="font-mono">{item.facultyId}</span>. The login email cannot be changed here.</p>
      <form.Field name="name">{(field) => <TextInputField field={field} label="Full name" />}</form.Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <form.Field name="phone">{(field) => <TextInputField field={field} label="Phone (optional)" type="tel" />}</form.Field>
        <form.Field name="designation">{(field) => <TextInputField field={field} label="Designation" />}</form.Field>
      </div>
      <form.Field name={departmentField}>
        {(field) => <SelectInputField field={field} label="Department" placeholder="Choose a department" options={departments} />}
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
