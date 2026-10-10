"use client";

import { useState } from "react";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import { useForm } from "@tanstack/react-form";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DataTable, type Column } from "@/components/admin/data-table";
import { FormDialog } from "@/components/admin/form-dialog";
import { ListToolbar, useListSearch } from "@/components/admin/list-toolbar";
import { Pagination } from "@/components/admin/pagination";
import { FormAlert } from "@/components/forms/form-alert";
import { SelectInputField, TextInputField } from "@/components/forms/form-fields";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/shared/page-header";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { useListState } from "@/hooks/use-list-state";
import { apiListRequest, apiRequest } from "@/lib/api/client";
import { toApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";
import { formatDate } from "@/lib/format";
import { summariseApiError } from "@/lib/forms/server-errors";
import { departmentSchema, type DepartmentInput } from "@/lib/validations/admin";
import type { Department, University } from "@/types/entities";

const FILTER_KEYS: string[] = [];
/** Radix Select cannot hold an empty value, so "no university" is a sentinel. */
const NO_UNIVERSITY = "none";

export function DepartmentsManager() {
  const list = useListState(FILTER_KEYS);
  const [search, setSearch] = useListSearch();
  const [dialog, setDialog] = useState<{ item: Department | null } | null>(null);
  const [toDelete, setToDelete] = useState<Department | null>(null);

  const departments = useApiQuery({
    queryKey: queryKeys.departments.list(list.query),
    queryFn: () => apiListRequest<Department>("/departments", list.query),
    keepPreviousData: true,
  });

  const remove = useApiMutation({
    mutationFn: (id: string) => apiRequest<null>(`/departments/${id}`, { method: "DELETE" }),
    successMessage: "Department deleted.",
    invalidate: [queryKeys.departments.all, queryKeys.adminStats],
    onSuccess: () => setToDelete(null),
  });

  const columns: Column<Department>[] = [
    {
      id: "name",
      header: "Name",
      sortKey: "name",
      cell: (department) => <span className="font-medium">{department.name}</span>,
    },
    {
      id: "code",
      header: "Code",
      sortKey: "code",
      cell: (department) => <Badge variant="outline" className="font-mono">{department.code}</Badge>,
    },
    {
      id: "university",
      header: "University",
      className: "hidden md:table-cell",
      cell: (department) => <span className="text-muted-foreground">{department.university?.name ?? "Not assigned"}</span>,
    },
    {
      id: "createdAt",
      header: "Added",
      sortKey: "createdAt",
      className: "hidden md:table-cell",
      cell: (department) => <span className="text-muted-foreground">{formatDate(department.createdAt)}</span>,
    },
  ];

  const sortBy = list.sortBy ?? "createdAt";
  const sortOrder = list.sortOrder ?? "desc";

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Academic setup"
        title="Departments"
        description="The academic units that own courses and faculty."
      />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchLabel="Search departments"
        searchPlaceholder="Search by name or code"
        action={
          <Button onClick={() => setDialog({ item: null })} className="bg-brand-gradient text-white hover:opacity-90">
            <Plus className="size-4" aria-hidden="true" />
            New department
          </Button>
        }
      />

      <DataTable
        caption="Departments"
        columns={columns}
        rows={departments.data?.data}
        isLoading={departments.isPending}
        isError={departments.isError}
        errorMessage={departments.error?.message}
        onRetry={() => void departments.refetch()}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSort={(sortKey, order) => list.update({ sortBy: sortKey, sortOrder: order, page: 1 })}
        emptyIcon={Building2}
        emptyTitle="No departments match"
        emptyDescription="Create a department to start setting up courses and faculty."
        rowActions={(department) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${department.name}`} onClick={() => setDialog({ item: department })}>
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Delete ${department.name}`} onClick={() => setToDelete(department)}>
              <Trash2 className="text-destructive size-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      />

      <Pagination
        meta={departments.data?.meta}
        limit={list.limit}
        onPageChange={(page) => list.update({ page })}
        onLimitChange={(limit) => list.update({ limit, page: 1 })}
      />

      <FormDialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        title={dialog?.item ? "Edit department" : "New department"}
        description="Departments are referenced by courses and faculty, so renaming one updates them everywhere."
      >
        {dialog ? <DepartmentForm item={dialog.item} onDone={() => setDialog(null)} /> : null}
      </FormDialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Delete ${toDelete?.name ?? "department"}?`}
        description="The department is hidden from the site. Courses and faculty already linked to it keep their record, but the department can no longer be selected."
        confirmLabel="Delete department"
        pending={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </div>
  );
}

function DepartmentForm({ item, onDone }: { item: Department | null; onDone: () => void }) {
  const [serverError, setServerError] = useState<{ message: string; details: string[] } | null>(null);

  const universities = useApiQuery({
    queryKey: queryKeys.universities.list({ limit: 100, sortBy: "name", sortOrder: "asc" }),
    queryFn: () => apiListRequest<University>("/universities", { limit: 100, sortBy: "name", sortOrder: "asc" }),
  });

  const save = useApiMutation<Department, DepartmentInput>({
    mutationFn: ({ universityId, ...values }) => {
      const body = { ...values, universityId: universityId === NO_UNIVERSITY ? null : universityId };
      return item
        ? apiRequest<Department>(`/departments/${item.id}`, { method: "PATCH", body })
        : apiRequest<Department>("/departments", { method: "POST", body });
    },
    notifyError: false,
    successMessage: item ? "Department updated." : "Department created.",
    invalidate: [queryKeys.departments.all, queryKeys.adminStats],
  });

  const form = useForm({
    defaultValues: { name: item?.name ?? "", code: item?.code ?? "", universityId: item?.universityId ?? NO_UNIVERSITY },
    validators: { onSubmit: departmentSchema },
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
    <form
      noValidate
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      {serverError ? <FormAlert message={serverError.message} details={serverError.details} /> : null}

      <form.Field name="name">
        {(field) => <TextInputField field={field} label="Name" placeholder="Computer Science and Engineering" />}
      </form.Field>
      <form.Field name="code">
        {(field) => <TextInputField field={field} label="Code" placeholder="CSE" hint="Two to twenty characters. Shown in upper case." />}
      </form.Field>

      <form.Field name="universityId">
        {(field) => (
          <SelectInputField
            field={field}
            label="University"
            placeholder={universities.isPending ? "Loading universities…" : "Not assigned"}
            options={[{ value: NO_UNIVERSITY, label: "Not assigned" }, ...(universities.data?.data.map((u) => ({ value: u.id, label: u.name })) ?? [])]}
            hint="Google sign-in only works for users whose department belongs to the university that owns their email domain."
          />
        )}
      </form.Field>

      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onDone}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || isSubmitting} className="bg-brand-gradient text-white hover:opacity-90">
              {isSubmitting ? "Saving…" : item ? "Save changes" : "Create department"}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
