"use client";

import { useState } from "react";
import { Bell, Pencil, Plus, Trash2 } from "lucide-react";
import { useForm } from "@tanstack/react-form";

import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import { DataTable, type Column } from "@/components/admin/data-table";
import { FormDialog } from "@/components/admin/form-dialog";
import { ListToolbar, useListSearch } from "@/components/admin/list-toolbar";
import { Pagination } from "@/components/admin/pagination";
import { FormAlert } from "@/components/forms/form-alert";
import { SelectInputField, TextInputField, TextareaField } from "@/components/forms/form-fields";
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
import { noticeSchema, type NoticeInput } from "@/lib/validations/admin";
import type { Notice, NoticeAudience } from "@/types/entities";

const audienceLabel: Record<NoticeAudience, string> = { ALL: "Everyone", STUDENT: "Students", FACULTY: "Faculty" };
const audienceOptions = (Object.keys(audienceLabel) as NoticeAudience[]).map((value) => ({ value, label: audienceLabel[value] }));

export function NoticesManager() {
  const list = useListState();
  const [search, setSearch] = useListSearch();
  const [dialog, setDialog] = useState<{ item: Notice | null } | null>(null);
  const [toDelete, setToDelete] = useState<Notice | null>(null);

  const notices = useApiQuery({
    queryKey: queryKeys.notices.list(list.query),
    queryFn: () => apiListRequest<Notice>("/notices", list.query),
    keepPreviousData: true,
  });

  const remove = useApiMutation({
    mutationFn: (id: string) => apiRequest<null>(`/notices/${id}`, { method: "DELETE" }),
    successMessage: "Notice deleted.",
    invalidate: [queryKeys.notices.all, queryKeys.adminStats],
    onSuccess: () => setToDelete(null),
  });

  const columns: Column<Notice>[] = [
    { id: "title", header: "Title", sortKey: "title", cell: (n) => <span className="font-medium">{n.title}</span> },
    { id: "audience", header: "Audience", cell: (n) => <Badge variant="secondary">{audienceLabel[n.audience]}</Badge> },
    { id: "createdAt", header: "Posted", sortKey: "createdAt", className: "hidden md:table-cell", cell: (n) => <span className="text-muted-foreground">{formatDate(n.createdAt)}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Communication" title="Notices" description="Announcements. Audience decides who sees each one when they log in." />

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchLabel="Search notices"
        searchPlaceholder="Search titles and content"
        action={
          <Button onClick={() => setDialog({ item: null })} className="bg-brand-gradient text-white hover:opacity-90">
            <Plus className="size-4" aria-hidden="true" />
            New notice
          </Button>
        }
      />

      <DataTable
        caption="Notices"
        columns={columns}
        rows={notices.data?.data}
        isLoading={notices.isPending}
        isError={notices.isError}
        errorMessage={notices.error?.message}
        onRetry={() => void notices.refetch()}
        sortBy={list.sortBy ?? "createdAt"}
        sortOrder={list.sortOrder ?? "desc"}
        onSort={(sortKey, order) => list.update({ sortBy: sortKey, sortOrder: order, page: 1 })}
        emptyIcon={Bell}
        emptyTitle="No notices yet"
        emptyDescription="Post an announcement and choose who should see it."
        rowActions={(n) => (
          <div className="flex justify-end gap-1">
            <Button variant="ghost" size="icon-sm" aria-label={`Edit ${n.title}`} onClick={() => setDialog({ item: n })}>
              <Pencil className="size-4" aria-hidden="true" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label={`Delete ${n.title}`} onClick={() => setToDelete(n)}>
              <Trash2 className="text-destructive size-4" aria-hidden="true" />
            </Button>
          </div>
        )}
      />

      <Pagination meta={notices.data?.meta} limit={list.limit} onPageChange={(page) => list.update({ page })} onLimitChange={(limit) => list.update({ limit, page: 1 })} />

      <FormDialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)} title={dialog?.item ? "Edit notice" : "New notice"}>
        {dialog ? <NoticeForm item={dialog.item} onDone={() => setDialog(null)} /> : null}
      </FormDialog>

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Delete "${toDelete?.title ?? "notice"}"?`}
        description="The notice disappears from every portal and from the public site."
        confirmLabel="Delete notice"
        pending={remove.isPending}
        onConfirm={() => toDelete && remove.mutate(toDelete.id)}
      />
    </div>
  );
}

function NoticeForm({ item, onDone }: { item: Notice | null; onDone: () => void }) {
  const [serverError, setServerError] = useState<{ message: string; details: string[] } | null>(null);

  const save = useApiMutation<Notice, NoticeInput>({
    mutationFn: (values) =>
      item
        ? apiRequest<Notice>(`/notices/${item.id}`, { method: "PATCH", body: values })
        : apiRequest<Notice>("/notices", { method: "POST", body: values }),
    notifyError: false,
    successMessage: item ? "Notice updated." : "Notice published.",
    invalidate: [queryKeys.notices.all, queryKeys.adminStats],
  });

  const form = useForm({
    defaultValues: { title: item?.title ?? "", content: item?.content ?? "", audience: item?.audience ?? "ALL" } as NoticeInput,
    validators: { onSubmit: noticeSchema },
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
      <form.Field name="title">{(field) => <TextInputField field={field} label="Title" placeholder="Midterm schedule released" />}</form.Field>
      <form.Field name="audience">{(field) => <SelectInputField field={field} label="Audience" placeholder="Choose who should see this" options={audienceOptions} />}</form.Field>
      <form.Field name="content">{(field) => <TextareaField field={field} label="Message" rows={6} />}</form.Field>
      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
            <Button type="submit" disabled={!canSubmit || isSubmitting} className="bg-brand-gradient text-white hover:opacity-90">
              {isSubmitting ? "Saving…" : item ? "Save changes" : "Publish notice"}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
