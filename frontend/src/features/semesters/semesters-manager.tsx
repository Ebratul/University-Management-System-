"use client";

import { useState } from "react";
import { CalendarRange, Pencil, Plus, Trash2 } from "lucide-react";
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
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { useListState } from "@/hooks/use-list-state";
import { apiListRequest, apiRequest } from "@/lib/api/client";
import { toApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";
import { formatDate } from "@/lib/format";
import { summariseApiError } from "@/lib/forms/server-errors";
import { semesterSchema, type SemesterInput } from "@/lib/validations/admin";
import type { Semester, SemesterStatus } from "@/types/entities";

const FILTER_KEYS = ["status"];

const statusLabel: Record<SemesterStatus, string> = { UPCOMING: "Upcoming", ONGOING: "Ongoing", COMPLETED: "Completed" };
const statusOptions = (Object.keys(statusLabel) as SemesterStatus[]).map((value) => ({ value, label: statusLabel[value] }));

const money = new Intl.NumberFormat("en-BD", { style: "currency", currency: "BDT", maximumFractionDigits: 0 });

export function SemestersManager() {
  const list = useListState(FILTER_KEYS);
  const [search, setSearch] = useListSearch();
  const [dialog, setDialog] = useState<{ item: Semester | null } | null>(null);
  const [toDelete, setToDelete] = useState<Semester | null>(null);

  const semesters = useApiQuery({
    queryKey: queryKeys.semesters.list(list.query),
    queryFn: () => apiListRequest<Semester>("/semesters", list.query),
    keepPreviousData: true,
  });

  const remove = useApiMutation({
    mutationFn: (id: string) => apiRequest<null>(`/semesters/${id}`, { method: "DELETE" }),
    successMessage: "Semester deleted.",
    invalidate: [queryKeys.semesters.all, queryKeys.adminStats],
    onSuccess: () => setToDelete(null),
  });

  const columns: Column<Semester>[] = [
    { id: "code", header: "Semester", sortKey: "code", cell: (s) => <span className="font-medium">{s.code} {s.year}</span> },
    {
      id: "dates",
      header: "Dates",
      sortKey: "startDate",
      className: "hidden md:table-cell",
      cell: (s) => <span className="text-muted-foreground">{formatDate(s.startDate)} – {formatDate(s.endDate)}</span>,
    },
    {
      id: "status",
      header: "Status",
      sortKey: "status",
      cell: (s) => <Badge variant={s.status === "ONGOING" ? "default" : "secondary"}>{statusLabel[s.status]}</Badge>,
    },
    { id: "fee", header: "Fee", className: "hidden sm:table-cell", cell: (s) => <span className="tabular-nums">{money.format(s.feeAmount)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Academic setup" title="Semesters" description="Terms with their dates, status and the tuition fee students pay." />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchLabel="Search semesters"
        searchPlaceholder="Search by code"
        filters={
          <select
            aria-label="Filter by status"
            value={list.filters.status ?? ""}
            onChange={(event) => list.update({ status: event.target.value })}
            className="border-input bg-background h-10 rounded-md border px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <option value="">All statuses</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        }
        action={
          <Button onClick={() => setDialog({ item: null })} className="bg-brand-gradient text-white hover:opacity-90">
            <Plus className="size-4" aria-hidden="true" />
            New semester
          </Button>
        }
      />

      <DataTable
        caption="Semesters"
        columns={columns}
        rows={semesters.data?.data}
        isLoading={semesters.isPending}
        isError={semesters.isError}
        errorMessage={semesters.error?.message}
        onRetry={() => void semesters.refetch()}
        sortBy={list.sortBy ?? "year"}
        sortOrder={list.sortOrder ?? "desc"}
        onSort={(sortKey, order) => list.update({ sortBy: sortKey, sortOrder: order, page: 1 })}
        emptyIcon={CalendarRange}
        emptyTitle="No semesters match"
        emptyDescription="Create a semester to schedule course offerings and collect fees."
        rowActions={(s) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${s.code} ${s.year}`} onClick={() => setDialog({ item: s })}>
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Delete ${s.code} ${s.year}`} onClick={() => setToDelete(s)}>
              <Trash2 className="text-destructive size-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      />

      <Pagination meta={semesters.data?.meta} limit={list.limit} onPageChange={(page) => list.update({ page })} onLimitChange={(limit) => list.update({ limit, page: 1 })} />

      <FormDialog
        open={dialog !== null}
        onOpenChange={(open) => !open && setDialog(null)}
        title={dialog?.item ? "Edit semester" : "New semester"}
        description="The fee here is what students are charged when they pay for this semester."
      >
        {dialog ? <SemesterForm item={dialog.item} onDone={() => setDialog(null)} /> : null}
      </FormDialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Delete ${toDelete?.code ?? "semester"} ${toDelete?.year ?? ""}?`}
        description="The semester is hidden. Existing payments and offerings keep their history, but it can no longer be selected."
        confirmLabel="Delete semester"
        pending={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </div>
  );
}

function SemesterForm({ item, onDone }: { item: Semester | null; onDone: () => void }) {
  const [serverError, setServerError] = useState<{ message: string; details: string[] } | null>(null);

  const save = useApiMutation<Semester, SemesterInput>({
    mutationFn: (values) => {
      const body = {
        year: Number(values.year),
        code: values.code,
        startDate: values.startDate,
        endDate: values.endDate,
        status: values.status,
        feeAmount: Number(values.feeAmount),
      };
      return item
        ? apiRequest<Semester>(`/semesters/${item.id}`, { method: "PATCH", body })
        : apiRequest<Semester>("/semesters", { method: "POST", body });
    },
    notifyError: false,
    successMessage: item ? "Semester updated." : "Semester created.",
    invalidate: [queryKeys.semesters.all, queryKeys.adminStats],
  });

  const form = useForm({
    defaultValues: {
      year: item ? String(item.year) : String(new Date().getFullYear()),
      code: item?.code ?? "",
      startDate: item ? item.startDate.slice(0, 10) : "",
      endDate: item ? item.endDate.slice(0, 10) : "",
      status: item?.status ?? "UPCOMING",
      feeAmount: item ? String(item.feeAmount) : "0",
    } as SemesterInput,
    validators: { onSubmit: semesterSchema },
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

      <div className="grid gap-5 sm:grid-cols-2">
        <form.Field name="code">{(field) => <TextInputField field={field} label="Code" placeholder="FALL" />}</form.Field>
        <form.Field name="year">{(field) => <TextInputField field={field} label="Year" inputMode="numeric" placeholder="2027" />}</form.Field>
        <form.Field name="startDate">{(field) => <TextInputField field={field} label="Start date" type="date" />}</form.Field>
        <form.Field name="endDate">{(field) => <TextInputField field={field} label="End date" type="date" />}</form.Field>
        <form.Field name="status">{(field) => <SelectInputField field={field} label="Status" placeholder="Choose a status" options={statusOptions} />}</form.Field>
        <form.Field name="feeAmount">{(field) => <TextInputField field={field} label="Tuition fee (BDT)" inputMode="decimal" hint="Students pay exactly this amount." />}</form.Field>
      </div>

      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
            <Button type="submit" disabled={!canSubmit || isSubmitting} className="bg-brand-gradient text-white hover:opacity-90">
              {isSubmitting ? "Saving…" : item ? "Save changes" : "Create semester"}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
