"use client";

import { useState } from "react";
import { Plus, UserRound } from "lucide-react";
import { useForm } from "@tanstack/react-form";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DataTable, type Column } from "@/components/admin/data-table";
import { FormDialog } from "@/components/admin/form-dialog";
import { ListToolbar, useListSearch } from "@/components/admin/list-toolbar";
import { Pagination } from "@/components/admin/pagination";
import { RowMenu, type RowMenuItem } from "@/components/admin/row-menu";
import { FormAlert } from "@/components/forms/form-alert";
import { TextInputField } from "@/components/forms/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { useListState } from "@/hooks/use-list-state";
import { apiListRequest, apiRequest } from "@/lib/api/client";
import { toApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";
import { ROLE_META } from "@/lib/auth/roles";
import { summariseApiError } from "@/lib/forms/server-errors";
import { adminUserSchema, type AdminUserInput } from "@/lib/validations/admin";
import type { AdminUser, Role } from "@/types/entities";

const FILTER_KEYS = ["role"];
const ROLES: Role[] = ["ADMIN", "FACULTY", "STUDENT"];

export function UsersManager() {
  const list = useListState(FILTER_KEYS);
  const [search, setSearch] = useListSearch();
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState<AdminUser | null>(null);

  const users = useApiQuery({
    queryKey: queryKeys.users.list(list.query),
    queryFn: () => apiListRequest<AdminUser>("/users", list.query),
    keepPreviousData: true,
  });

  const invalidateUsers = [queryKeys.users.all, queryKeys.adminStats];

  const changeRole = useApiMutation<AdminUser, { user: AdminUser; role: Role }>({
    mutationFn: ({ user, role }) => apiRequest<AdminUser>(`/users/${user.id}/role`, { method: "PATCH", body: { role } }),
    successMessage: ({ role }) => `Role changed to ${ROLE_META[role].label}.`,
    invalidate: invalidateUsers,
  });

  const changeStatus = useApiMutation<AdminUser, { user: AdminUser; isActive: boolean }>({
    mutationFn: ({ user, isActive }) => apiRequest<AdminUser>(`/users/${user.id}/status`, { method: "PATCH", body: { isActive } }),
    successMessage: ({ isActive }) => (isActive ? "Account activated." : "Account deactivated."),
    invalidate: invalidateUsers,
  });

  const remove = useApiMutation({
    mutationFn: (id: string) => apiRequest<null>(`/users/${id}`, { method: "DELETE" }),
    successMessage: "Account deleted.",
    invalidate: invalidateUsers,
    onSuccess: () => setToDelete(null),
  });

  const columns: Column<AdminUser>[] = [
    {
      id: "email",
      header: "Account",
      cell: (user) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{user.admin?.name ?? user.faculty?.name ?? user.student?.name ?? user.email}</p>
          <p className="text-muted-foreground truncate text-xs">{user.email}</p>
        </div>
      ),
    },
    { id: "role", header: "Role", cell: (user) => <Badge variant="secondary">{ROLE_META[user.role].label}</Badge> },
    {
      id: "status",
      header: "Status",
      className: "hidden sm:table-cell",
      cell: (user) => (user.isActive ? <Badge>Active</Badge> : <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>),
    },
    {
      id: "createdAt",
      header: "Created",
      className: "hidden lg:table-cell",
      cell: (user) => <span className="text-muted-foreground text-sm">{new Date(user.createdAt).toLocaleDateString("en-GB")}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="People" title="Users" description="Every login in the system. Changing a role only works if the account already has a profile for that role." />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchLabel="Search users"
        searchPlaceholder="Search by email"
        filters={
          <select
            aria-label="Filter by role"
            value={list.filters.role ?? ""}
            onChange={(event) => list.update({ role: event.target.value })}
            className="border-input bg-background h-10 rounded-md border px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">All roles</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>{ROLE_META[role].label}</option>
            ))}
          </select>
        }
        action={
          <Button onClick={() => setCreating(true)} className="bg-brand-gradient text-white hover:opacity-90">
            <Plus className="size-4" aria-hidden="true" />
            New administrator
          </Button>
        }
      />

      <DataTable
        caption="User accounts"
        columns={columns}
        rows={users.data?.data}
        isLoading={users.isPending}
        isError={users.isError}
        errorMessage={users.error?.message}
        onRetry={() => void users.refetch()}
        emptyIcon={UserRound}
        emptyTitle="No accounts match"
        emptyDescription="Try another search or role filter."
        rowActions={(user) => {
          const items: RowMenuItem[] = [
            ...ROLES.filter((role) => role !== user.role).map((role) => ({
              label: `Make ${ROLE_META[role].label.toLowerCase()}`,
              onSelect: () => changeRole.mutate({ user, role }),
            })),
            {
              label: user.isActive ? "Deactivate account" : "Activate account",
              onSelect: () => changeStatus.mutate({ user, isActive: !user.isActive }),
            },
            { label: "Delete account", destructive: true, onSelect: () => setToDelete(user) },
          ];
          return <RowMenu label={user.email} groupLabel="Account" items={items} />;
        }}
      />

      <Pagination meta={users.data?.meta} limit={list.limit} onPageChange={(page) => list.update({ page })} onLimitChange={(limit) => list.update({ limit, page: 1 })} />

      <FormDialog open={creating} onOpenChange={setCreating} title="New administrator" description="Creates an admin login. Share the temporary password through a secure channel.">
        {creating ? <AdminCreateForm onDone={() => setCreating(false)} /> : null}
      </FormDialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Delete ${toDelete?.email ?? "account"}?`}
        description="The login is removed and cannot sign in. Records the account created (enrolments, notices, results) stay in place."
        confirmLabel="Delete account"
        pending={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </div>
  );
}

function AdminCreateForm({ onDone }: { onDone: () => void }) {
  const [serverError, setServerError] = useState<{ message: string; details: string[] } | null>(null);

  const create = useApiMutation<AdminUser, AdminUserInput>({
    mutationFn: (values) =>
      apiRequest<AdminUser>("/users", {
        method: "POST",
        body: { name: values.name, email: values.email, password: values.password, ...(values.phone ? { phone: values.phone } : {}) },
      }),
    notifyError: false,
    successMessage: "Administrator created.",
    invalidate: [queryKeys.users.all, queryKeys.adminStats],
  });

  const form = useForm({
    defaultValues: { name: "", email: "", password: "", phone: "" },
    validators: { onSubmit: adminUserSchema },
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
      <form.Field name="password">{(field) => <TextInputField field={field} label="Temporary password" type="password" autoComplete="new-password" hint="8+ characters with upper, lower, number and symbol." />}</form.Field>
      <form.Field name="phone">{(field) => <TextInputField field={field} label="Phone (optional)" type="tel" />}</form.Field>
      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
            <Button type="submit" disabled={!canSubmit || isSubmitting} className="bg-brand-gradient text-white hover:opacity-90">
              {isSubmitting ? "Creating…" : "Create administrator"}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}

