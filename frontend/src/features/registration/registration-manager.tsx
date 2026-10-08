"use client";

import { useState } from "react";
import Link from "next/link";
import { useForm } from "@tanstack/react-form";
import { BadgeDollarSign, CheckCircle2, Clock, GraduationCap, Hourglass, Layers, Settings2, Users } from "lucide-react";

import { DataTable, type Column } from "@/components/admin/data-table";
import { FormDialog } from "@/components/admin/form-dialog";
import { ListToolbar, useListSearch } from "@/components/admin/list-toolbar";
import { Pagination } from "@/components/admin/pagination";
import { FormAlert } from "@/components/forms/form-alert";
import { TextInputField } from "@/components/forms/form-fields";
import { PageHeader } from "@/components/shared/page-header";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { useListState } from "@/hooks/use-list-state";
import { useDepartmentOptions, useSemesterOptions } from "@/hooks/use-options";
import { apiListRequest } from "@/lib/api/client";
import { registrationAdminApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";
import { formatDateTime, formatPaisa } from "@/lib/format";
import { summariseApiError } from "@/lib/forms/server-errors";
import { registrationSettingSchema, toSettingDefaults, toSettingPayload, type RegistrationSettingFormInput } from "@/lib/validations/registration";
import type { Registration, RegistrationSettingRow } from "@/types/entities";
import { InvoiceStatusBadge, RegistrationStatusBadge, WindowStateBadge } from "./registration-status";

const FILTER_KEYS = ["semesterId", "departmentId", "status", "paymentStatus"];

export function RegistrationManager() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Academic setup"
        title="Course registration"
        description="Set the credit fees, credit limits and registration windows for each semester, and follow every student's registration and payment."
      />
      <Tabs defaultValue="registrations" className="gap-6">
        <TabsList variant="line" className="h-10 justify-start gap-2 border-b pb-0">
          <TabsTrigger value="registrations" className="flex-none px-3">Registrations</TabsTrigger>
          <TabsTrigger value="settings" className="flex-none px-3">Fees &amp; windows</TabsTrigger>
        </TabsList>
        <TabsContent value="registrations"><RegistrationsPanel /></TabsContent>
        <TabsContent value="settings"><SettingsPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

// ------------------------------ registrations ------------------------------

const selectClass = "border-input bg-background h-10 max-w-56 rounded-md border px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

function RegistrationsPanel() {
  const list = useListState(FILTER_KEYS);
  const [search, setSearch] = useListSearch();
  const semesters = useSemesterOptions();
  const departments = useDepartmentOptions();

  const statsQuery = {
    semesterId: list.filters.semesterId,
    departmentId: list.filters.departmentId,
    searchTerm: list.searchTerm,
  };
  const stats = useApiQuery({
    queryKey: queryKeys.registrations.stats(statsQuery),
    queryFn: () => registrationAdminApi.stats(statsQuery),
    keepPreviousData: true,
  });
  const registrations = useApiQuery({
    queryKey: queryKeys.registrations.list(list.query),
    queryFn: () => apiListRequest<Registration>("/registrations", list.query),
    keepPreviousData: true,
  });

  const columns: Column<Registration>[] = [
    {
      id: "student",
      header: "Student",
      cell: (r) => (
        <div className="flex min-w-0 items-center gap-3">
          <PersonAvatar name={r.student.name} imageUrl={r.student.user.imageUrl} />
          <div className="min-w-0">
            <p className="truncate font-medium">{r.student.name}</p>
            <p className="text-muted-foreground font-mono text-xs">{r.student.registrationNumber}</p>
          </div>
        </div>
      ),
    },
    {
      id: "registration",
      header: "Registration",
      sortKey: "createdAt",
      cell: (r) => (
        <Link href={`/admin/registration/${r.id}`} className="underline-offset-4 hover:underline">
          <span className="font-mono text-xs">{r.registrationNo}</span>
          <span className="text-muted-foreground block text-xs">{r.semester.code} {r.semester.year}</span>
        </Link>
      ),
    },
    { id: "department", header: "Department", className: "hidden xl:table-cell", cell: (r) => <span className="text-muted-foreground">{r.student.department.code}</span> },
    { id: "credits", header: "Credits", sortKey: "totalCredits", className: "hidden md:table-cell", cell: (r) => <span className="tabular-nums">{r.totalCredits}</span> },
    { id: "fee", header: "Total", cell: (r) => <span className="tabular-nums">{r.invoice ? formatPaisa(r.invoice.totalAmount) : "—"}</span> },
    { id: "payment", header: "Payment", className: "hidden md:table-cell", cell: (r) => (r.invoice ? <InvoiceStatusBadge status={r.invoice.status} /> : "—") },
    { id: "status", header: "Status", sortKey: "status", cell: (r) => <RegistrationStatusBadge status={r.status} /> },
  ];

  return (
    <div className="space-y-6">
      {stats.data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Registered students" value={stats.data.totalRegisteredStudents} hint="With a confirmed registration" icon={Users} tone="indigo" />
          <StatCard label="Confirmed" value={stats.data.totalConfirmed} icon={CheckCircle2} tone="teal" />
          <StatCard label="Paid invoices" value={stats.data.totalPaid} icon={BadgeDollarSign} tone="violet" />
          <StatCard label="Collected" value={formatPaisa(stats.data.totalCollected)} hint="From paid invoices" icon={BadgeDollarSign} tone="amber" />
          <StatCard label="Unpaid" value={stats.data.totalUnpaid} hint="Awaiting payment" icon={Clock} tone="rose" />
          <StatCard label="Payment pending" value={stats.data.totalPending} hint="bKash is confirming" icon={Hourglass} tone="sky" />
          <StatCard label="Registered credits" value={stats.data.totalRegisteredCredits} hint="Across confirmed registrations" icon={Layers} tone="indigo" />
          <StatCard label="All registrations" value={Object.values(stats.data.byStatus).reduce((a, b) => a + b, 0)} hint="Including cancelled and expired" icon={GraduationCap} tone="violet" />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      )}

      <ListToolbar
        search={search}
        onSearchChange={setSearch}
        searchLabel="Search registrations"
        searchPlaceholder="Student, registration or invoice no."
        filters={
          <div className="flex flex-wrap gap-2">
            <select aria-label="Filter by semester" value={list.filters.semesterId ?? ""} onChange={(e) => list.update({ semesterId: e.target.value })} className={selectClass}>
              <option value="">All semesters</option>
              {semesters.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select aria-label="Filter by department" value={list.filters.departmentId ?? ""} onChange={(e) => list.update({ departmentId: e.target.value })} className={selectClass}>
              <option value="">All departments</option>
              {departments.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <select aria-label="Filter by registration status" value={list.filters.status ?? ""} onChange={(e) => list.update({ status: e.target.value })} className={selectClass}>
              <option value="">Any status</option>
              {["SUBMITTED", "PAYMENT_PENDING", "CONFIRMED", "CANCELLED", "REJECTED", "EXPIRED"].map((s) => <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>)}
            </select>
            <select aria-label="Filter by payment status" value={list.filters.paymentStatus ?? ""} onChange={(e) => list.update({ paymentStatus: e.target.value })} className={selectClass}>
              <option value="">Any payment</option>
              {["UNPAID", "PENDING", "PAID", "FAILED", "CANCELLED", "EXPIRED"].map((s) => <option key={s} value={s}>{s.toLowerCase()}</option>)}
            </select>
          </div>
        }
      />

      <DataTable
        caption="Course registrations"
        columns={columns}
        rows={registrations.data?.data}
        isLoading={registrations.isPending}
        isError={registrations.isError}
        errorMessage={registrations.error?.message}
        onRetry={() => void registrations.refetch()}
        sortBy={list.sortBy ?? "createdAt"}
        sortOrder={list.sortOrder ?? "desc"}
        onSort={(sortKey, order) => list.update({ sortBy: sortKey, sortOrder: order, page: 1 })}
        emptyIcon={GraduationCap}
        emptyTitle="No registrations match"
        emptyDescription="Registrations appear here once students submit them."
        rowActions={(r) => (
          <Button asChild variant="outline" size="sm"><Link href={`/admin/registration/${r.id}`}>View</Link></Button>
        )}
      />
      <Pagination meta={registrations.data?.meta} limit={list.limit} onPageChange={(page) => list.update({ page })} onLimitChange={(limit) => list.update({ limit, page: 1 })} />
    </div>
  );
}

// -------------------------------- settings --------------------------------

type Row = RegistrationSettingRow & { id: string };

function SettingsPanel() {
  const [editing, setEditing] = useState<Row | null>(null);
  const settings = useApiQuery({
    queryKey: queryKeys.registrationSettings,
    queryFn: registrationAdminApi.settings,
  });

  const columns: Column<Row>[] = [
    {
      id: "semester",
      header: "Semester",
      cell: (r) => (
        <div>
          <p className="font-medium">{r.semester.code} {r.semester.year}</p>
          <p className="text-muted-foreground text-xs capitalize">{r.semester.status.toLowerCase()}</p>
        </div>
      ),
    },
    { id: "state", header: "Registration", cell: (r) => <WindowStateBadge state={r.windowState} /> },
    {
      id: "rates",
      header: "Per credit",
      className: "hidden md:table-cell",
      cell: (r) =>
        r.configured ? (
          <span className="text-sm tabular-nums">
            Theory {formatPaisa(r.setting.theoryRate)} · Practical {formatPaisa(r.setting.practicalRate)}
          </span>
        ) : (
          <span className="text-muted-foreground text-sm">Not configured</span>
        ),
    },
    {
      id: "window",
      header: "Window",
      className: "hidden lg:table-cell",
      cell: (r) =>
        r.setting.registrationStart && r.setting.registrationEnd ? (
          <span className="text-muted-foreground text-xs">{formatDateTime(r.setting.registrationStart)} → {formatDateTime(r.setting.registrationEnd)}</span>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        ),
    },
    {
      id: "limits",
      header: "Credits",
      className: "hidden xl:table-cell",
      cell: (r) => <span className="text-sm tabular-nums">{r.configured ? `${r.setting.minCredits}–${r.setting.maxCredits}` : "—"}</span>,
    },
  ];

  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Fees apply to registrations made <em>after</em> you save. Invoices that already exist keep the rates they were created with.
      </p>
      <DataTable
        caption="Registration settings by semester"
        columns={columns}
        rows={settings.data?.map((r) => ({ ...r, id: r.semester.id }))}
        isLoading={settings.isPending}
        isError={settings.isError}
        errorMessage={settings.error?.message}
        onRetry={() => void settings.refetch()}
        emptyIcon={Settings2}
        emptyTitle="No semesters yet"
        emptyDescription="Create a semester first, then configure its registration here."
        rowActions={(r) => (
          <Button variant="outline" size="sm" onClick={() => setEditing(r)}>
            <Settings2 className="size-4" aria-hidden="true" /> {r.configured ? "Edit" : "Configure"}
          </Button>
        )}
      />
      <FormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing ? `Registration — ${editing.semester.code} ${editing.semester.year}` : "Registration"}
        description="Amounts are in BDT. Credits can be whole or half."
      >
        {editing ? <SettingsForm row={editing} onDone={() => setEditing(null)} /> : null}
      </FormDialog>
    </div>
  );
}

function SettingsForm({ row, onDone }: { row: Row; onDone: () => void }) {
  const [serverError, setServerError] = useState<{ message: string; details: string[] } | null>(null);

  const save = useApiMutation({
    mutationFn: (values: RegistrationSettingFormInput) => registrationAdminApi.saveSetting(row.semester.id, toSettingPayload(values)),
    notifyError: false,
    successMessage: "Registration settings saved.",
    invalidate: [queryKeys.registrationSettings, queryKeys.registrations.all],
  });

  const form = useForm({
    defaultValues: toSettingDefaults(row.setting),
    validators: { onSubmit: registrationSettingSchema },
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
    <form noValidate className="space-y-6" onSubmit={(event) => { event.preventDefault(); event.stopPropagation(); void form.handleSubmit(); }}>
      {serverError ? <FormAlert message={serverError.message} details={serverError.details} /> : null}

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Credit fees (BDT per credit)</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <form.Field name="theoryRate">{(f) => <TextInputField field={f} label="Theory" inputMode="decimal" />}</form.Field>
          <form.Field name="practicalRate">{(f) => <TextInputField field={f} label="Practical" inputMode="decimal" />}</form.Field>
          <form.Field name="otherRate">{(f) => <TextInputField field={f} label="Project / thesis" inputMode="decimal" />}</form.Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="registrationFee">{(f) => <TextInputField field={f} label="Registration fee (flat)" inputMode="decimal" />}</form.Field>
          <form.Field name="lateFee">{(f) => <TextInputField field={f} label="Late registration fee (flat)" inputMode="decimal" />}</form.Field>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Credit limits</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="minCredits">{(f) => <TextInputField field={f} label="Minimum credits" inputMode="decimal" hint="0 = no minimum." />}</form.Field>
          <form.Field name="maxCredits">{(f) => <TextInputField field={f} label="Maximum credits" inputMode="decimal" />}</form.Field>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Registration window</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <form.Field name="registrationStart">{(f) => <TextInputField field={f} label="Opens" type="datetime-local" />}</form.Field>
          <form.Field name="registrationEnd">{(f) => <TextInputField field={f} label="Closes" type="datetime-local" />}</form.Field>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Late registration</legend>
        <form.Field name="lateEnabled">
          {(f) => (
            <label className="flex items-start gap-3 text-sm">
              <input type="checkbox" checked={f.state.value} onChange={(e) => f.handleChange(e.target.checked)} className="mt-0.5 size-4" />
              <span>
                <span className="font-medium">Allow late registration</span>
                <span className="text-muted-foreground block text-xs">After the regular window closes, students can still register and pay the late fee.</span>
              </span>
            </label>
          )}
        </form.Field>
        <form.Subscribe selector={(s) => s.values.lateEnabled}>
          {(enabled) =>
            enabled ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <form.Field name="lateStart">{(f) => <TextInputField field={f} label="Late registration opens" type="datetime-local" />}</form.Field>
                <form.Field name="lateEnd">{(f) => <TextInputField field={f} label="Late registration closes" type="datetime-local" />}</form.Field>
              </div>
            ) : null
          }
        </form.Subscribe>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold">Invoices</legend>
        <form.Field name="invoiceValidityHours">
          {(f) => <TextInputField field={f} label="Unpaid invoice stays payable for (hours)" inputMode="numeric" hint="After this the registration expires and its seats are released." className="max-w-xs" />}
        </form.Field>
      </fieldset>

      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
            <Button type="submit" disabled={!canSubmit || isSubmitting} className="bg-brand-gradient text-white hover:opacity-90">
              {isSubmitting ? "Saving…" : "Save settings"}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
