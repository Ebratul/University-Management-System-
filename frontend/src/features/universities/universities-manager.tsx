"use client";

import { useState } from "react";
import { GraduationCap, Pencil, Plus } from "lucide-react";
import { useForm } from "@tanstack/react-form";

import { DataTable, type Column } from "@/components/admin/data-table";
import { FormDialog } from "@/components/admin/form-dialog";
import { ListToolbar, useListSearch } from "@/components/admin/list-toolbar";
import { Pagination } from "@/components/admin/pagination";
import { FormAlert } from "@/components/forms/form-alert";
import { TextInputField } from "@/components/forms/form-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { useListState } from "@/hooks/use-list-state";
import { apiListRequest, apiRequest } from "@/lib/api/client";
import { toApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";
import { summariseApiError } from "@/lib/forms/server-errors";
import { universitySchema, type UniversityInput } from "@/lib/validations/admin";
import type { University } from "@/types/entities";

const FILTER_KEYS: string[] = [];

export function UniversitiesManager() {
  const list = useListState(FILTER_KEYS);
  const [search, setSearch] = useListSearch();
  const [dialog, setDialog] = useState<{ item: University | null } | null>(null);

  const universities = useApiQuery({
    queryKey: queryKeys.universities.list(list.query),
    queryFn: () => apiListRequest<University>("/universities", list.query),
    keepPreviousData: true,
  });

  const columns: Column<University>[] = [
    { id: "name", header: "University", sortKey: "name", cell: (u) => <span className="font-medium">{u.name}</span> },
    { id: "student", header: "Student domain", cell: (u) => <Badge variant="outline" className="font-mono">{u.studentDomain}</Badge> },
    { id: "teacher", header: "Teacher domain", cell: (u) => <Badge variant="outline" className="font-mono">{u.teacherDomain}</Badge> },
    {
      id: "departments",
      header: "Departments",
      className: "hidden md:table-cell",
      cell: (u) => <span className="text-muted-foreground">{u._count?.departments ?? 0}</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: (u) => <Badge variant={u.isActive ? "secondary" : "outline"}>{u.isActive ? "Active" : "Inactive"}</Badge>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Academic setup"
        title="Universities"
        description="The email domains that may sign in with Google. A matching domain is not enough: the user must already have an account, the right role and a department in the university."
      />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchLabel="Search universities"
        searchPlaceholder="Search by name or domain"
        action={
          <Button onClick={() => setDialog({ item: null })} className="bg-brand-gradient text-white hover:opacity-90">
            <Plus className="size-4" aria-hidden="true" />
            New university
          </Button>
        }
      />

      <DataTable
        caption="Universities"
        columns={columns}
        rows={universities.data?.data}
        isLoading={universities.isPending}
        isError={universities.isError}
        errorMessage={universities.error?.message}
        onRetry={() => void universities.refetch()}
        sortBy={list.sortBy ?? "createdAt"}
        sortOrder={list.sortOrder ?? "desc"}
        onSort={(sortKey, order) => list.update({ sortBy: sortKey, sortOrder: order, page: 1 })}
        emptyIcon={GraduationCap}
        emptyTitle="No universities yet"
        emptyDescription="Add a university and its student and teacher email domains to allow Google sign-in."
        rowActions={(u) => (
          <div className="flex justify-end">
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${u.name}`} onClick={() => setDialog({ item: u })}>
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      />

      <Pagination
        meta={universities.data?.meta}
        limit={list.limit}
        onPageChange={(page) => list.update({ page })}
        onLimitChange={(limit) => list.update({ limit, page: 1 })}
      />

      <FormDialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        title={dialog?.item ? "Edit university" : "New university"}
        description="Assign departments to this university on the Departments page. Universities are deactivated, not deleted."
      >
        {dialog ? <UniversityForm item={dialog.item} onDone={() => setDialog(null)} /> : null}
      </FormDialog>
    </div>
  );
}

function UniversityForm({ item, onDone }: { item: University | null; onDone: () => void }) {
  const [serverError, setServerError] = useState<{ message: string; details: string[] } | null>(null);

  const save = useApiMutation<University, UniversityInput>({
    mutationFn: (values) =>
      item
        ? apiRequest<University>(`/universities/${item.id}`, { method: "PATCH", body: values })
        : apiRequest<University>("/universities", { method: "POST", body: values }),
    notifyError: false,
    successMessage: item ? "University updated." : "University created.",
    invalidate: [queryKeys.universities.all, queryKeys.departments.all],
  });

  const form = useForm({
    defaultValues: {
      name: item?.name ?? "",
      studentDomain: item?.studentDomain ?? "",
      teacherDomain: item?.teacherDomain ?? "",
      isActive: item?.isActive ?? true,
    },
    validators: { onSubmit: universitySchema },
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
        {(field) => <TextInputField field={field} label="University name" placeholder="Shahjalal University of Science and Technology" />}
      </form.Field>
      <form.Field name="studentDomain">
        {(field) => <TextInputField field={field} label="Student email domain" placeholder="student.sust.edu" hint="Everything after the @ in student emails." />}
      </form.Field>
      <form.Field name="teacherDomain">
        {(field) => <TextInputField field={field} label="Teacher email domain" placeholder="teacher.sust.edu" hint="Everything after the @ in teacher emails." />}
      </form.Field>

      <form.Field name="isActive">
        {(field) => (
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={field.state.value}
              onChange={(event) => field.handleChange(event.target.checked)}
              className="size-4"
            />
            <span>
              <span className="font-medium">Active</span>
              <span className="text-muted-foreground block text-xs">Inactive universities cannot sign in with Google.</span>
            </span>
          </label>
        )}
      </form.Field>

      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onDone}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || isSubmitting} className="bg-brand-gradient text-white hover:opacity-90">
              {isSubmitting ? "Saving…" : item ? "Save changes" : "Create university"}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
