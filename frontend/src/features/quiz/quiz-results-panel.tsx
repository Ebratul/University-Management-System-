"use client";

import { useDeferredValue, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ, ListChecks, Search, Users } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { StatCard } from "@/components/shared/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useApiQuery } from "@/hooks/use-api-query";
import { quizApi } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/query-keys";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { QuizStatus } from "@/types/entities";

const SORTS = [
  { value: "registrationNumber", label: "Registration no." },
  { value: "name", label: "Name" },
  { value: "score", label: "Score" },
  { value: "submittedAt", label: "Submitted at" },
];

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  SUBMITTED: { label: "Submitted", className: "bg-success/15 text-success" },
  AUTO_SUBMITTED: { label: "Auto-submitted", className: "bg-warning/25 text-amber-800 dark:text-warning" },
  IN_PROGRESS: { label: "In progress", className: "bg-brand-sky/15 text-brand-sky" },
  NOT_ATTEMPTED: { label: "Not attempted", className: "bg-muted text-muted-foreground" },
};

/** Per-student results for one quiz, with search and sorting. Course-scoped by the API. */
export function QuizResultsPanel({ quizId, status }: { quizId: string; status: QuizStatus }) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("registrationNumber");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const deferredSearch = useDeferredValue(search);

  const query = { search: deferredSearch || undefined, sortBy, order };
  const results = useApiQuery({
    queryKey: queryKeys.quiz.results(quizId, query),
    queryFn: () => quizApi.results(quizId, query),
    keepPreviousData: true,
    refetchInterval: status === "ACTIVE" ? 10_000 : false,
  });

  if (status === "DRAFT" || status === "UPCOMING") {
    return <EmptyState icon={ListChecks} title="No results yet" description="Results appear after you start the quiz and students submit." />;
  }

  return (
    <div className="space-y-6">
      {results.data ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Enrolled" value={results.data.summary.enrolled} icon={Users} tone="indigo" />
          <StatCard label="Attempted" value={results.data.summary.attempted} hint={`of ${results.data.summary.enrolled} students`} icon={ListChecks} tone="teal" />
          <StatCard label="Average score" value={`${results.data.summary.averagePercentage}%`} icon={ListChecks} tone="violet" />
        </div>
      ) : null}

      <div className="flex flex-wrap items-end gap-3">
        <div className="relative min-w-52 flex-1">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" aria-hidden="true" />
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or registration no." aria-label="Search students" className="h-10 pl-9" />
        </div>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="h-10 w-48" aria-label="Sort by">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                Sort: {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" className="h-10" onClick={() => setOrder((o) => (o === "asc" ? "desc" : "asc"))} aria-label={order === "asc" ? "Ascending. Switch to descending" : "Descending. Switch to ascending"}>
          {order === "asc" ? <ArrowDownAZ className="size-4" aria-hidden="true" /> : <ArrowUpAZ className="size-4" aria-hidden="true" />}
          {order === "asc" ? "Ascending" : "Descending"}
        </Button>
      </div>

      {results.isPending ? (
        <Skeleton className="h-64 w-full rounded-xl" />
      ) : results.isError ? (
        <EmptyState icon={ListChecks} title="Could not load results" description={results.error.message} action={<Button variant="outline" onClick={() => void results.refetch()}>Try again</Button>} />
      ) : results.data.results.length === 0 ? (
        <EmptyState icon={Users} title="No students match" description="Try a different search." />
      ) : (
        <div className={cn("overflow-x-auto rounded-xl border", results.isPlaceholderData && "opacity-60")}>
          <Table>
            <caption className="sr-only">Results for {results.data.quiz.title}</caption>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead className="text-right">%</TableHead>
                <TableHead className="hidden lg:table-cell">Submitted</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.data.results.map((r) => {
                const s = STATUS_LABEL[r.status];
                return (
                  <TableRow key={r.student.id}>
                    <TableCell>
                      <div className="flex min-w-0 items-center gap-3">
                        <PersonAvatar name={r.student.name} imageUrl={r.student.imageUrl} />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{r.student.name}</p>
                          <p className="text-muted-foreground font-mono text-xs">{r.student.registrationNumber}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge variant="outline" className={cn("border-transparent", s.className)}>
                        {s.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{r.score === null ? "—" : `${r.score}/${r.totalQuestions}`}</TableCell>
                    <TableCell className="text-right tabular-nums">{r.percentage === null ? "—" : `${r.percentage}%`}</TableCell>
                    <TableCell className="text-muted-foreground hidden text-sm lg:table-cell">{r.submittedAt ? formatDateTime(r.submittedAt) : "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
