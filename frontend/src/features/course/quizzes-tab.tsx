"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "@tanstack/react-form";
import { Clock, FileQuestion, ListChecks, Plus } from "lucide-react";
import { z } from "zod";

import { FormDialog } from "@/components/admin/form-dialog";
import { FormAlert } from "@/components/forms/form-alert";
import { TextInputField } from "@/components/forms/form-fields";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { materialApi, quizApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";
import { formatDateTime } from "@/lib/format";
import { summariseApiError } from "@/lib/forms/server-errors";
import { QuizStatusBadge } from "@/features/quiz/quiz-status-badge";
import type { QuizListItem } from "@/types/entities";

export function QuizzesTab({ offeringId, isStaff }: { offeringId: string; isStaff: boolean }) {
  const [creating, setCreating] = useState(false);
  const quizzes = useApiQuery({
    queryKey: queryKeys.course.quizzes(offeringId),
    queryFn: () => quizApi.list(offeringId),
    // An active quiz can end at any moment; keep the list honest while it is open.
    refetchInterval: (query) => (query.state.data?.quizzes.some((q) => q.status === "ACTIVE") ? 15_000 : false),
  });

  return (
    <div className="space-y-6">
      {isStaff ? (
        <div className="flex justify-end">
          <Button onClick={() => setCreating(true)} className="bg-brand-gradient text-white hover:opacity-90">
            <Plus className="size-4" aria-hidden="true" /> Create quiz
          </Button>
        </div>
      ) : null}

      {quizzes.isPending ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : quizzes.isError ? (
        <EmptyState
          icon={ListChecks}
          title="Could not load quizzes"
          description={quizzes.error.message}
          action={
            <Button variant="outline" onClick={() => void quizzes.refetch()}>
              Try again
            </Button>
          }
        />
      ) : quizzes.data.quizzes.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="No quizzes yet"
          description={isStaff ? "Create a quiz, or generate its questions from one of your PDFs with AI." : "Quizzes your teacher publishes will appear here."}
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {quizzes.data.quizzes.map((quiz) => (
            <li key={quiz.id}>
              <QuizCard quiz={quiz} isStaff={isStaff} />
            </li>
          ))}
        </ul>
      )}

      {isStaff ? (
        <FormDialog open={creating} onOpenChange={setCreating} title="Create a quiz" description="It starts as a draft. Add questions next, by hand or with AI, then publish and start it.">
          {creating ? <CreateQuizForm offeringId={offeringId} onDone={() => setCreating(false)} /> : null}
        </FormDialog>
      ) : null}
    </div>
  );
}

function QuizCard({ quiz, isStaff }: { quiz: QuizListItem; isStaff: boolean }) {
  const href = isStaff ? `/faculty/quizzes/${quiz.id}` : `/student/quizzes/${quiz.id}`;
  const attempt = quiz.myAttempt;

  let action: React.ReactNode;
  if (isStaff) {
    action = (
      <Button asChild variant="outline" size="sm">
        <Link href={href}>{quiz.status === "DRAFT" ? "Edit quiz" : "Open"}</Link>
      </Button>
    );
  } else if (attempt && attempt.status !== "IN_PROGRESS") {
    action = (
      <Button asChild variant="outline" size="sm">
        <Link href={href}>View result</Link>
      </Button>
    );
  } else if (quiz.status === "ACTIVE") {
    action = (
      <Button asChild size="sm" className="bg-brand-gradient text-white hover:opacity-90">
        <Link href={href}>{attempt ? "Continue quiz" : "Start quiz"}</Link>
      </Button>
    );
  } else if (quiz.status === "UPCOMING") {
    action = <span className="text-muted-foreground text-sm">Quiz has not started yet.</span>;
  } else {
    action = <span className="text-muted-foreground text-sm">You did not take this quiz.</span>;
  }

  return (
    <Card className="h-full transition-shadow hover:shadow-md">
      <CardContent className="flex h-full flex-col gap-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <h3 className="truncate text-base font-semibold" title={quiz.title}>
              {quiz.title}
            </h3>
            {quiz.description ? <p className="text-muted-foreground line-clamp-2 text-sm">{quiz.description}</p> : null}
          </div>
          <QuizStatusBadge status={quiz.status} />
        </div>

        <div className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden="true" /> {quiz.durationMinutes} min
          </span>
          <span className="inline-flex items-center gap-1">
            <FileQuestion className="size-3.5" aria-hidden="true" /> {quiz._count.questions} question(s)
          </span>
          {quiz.material ? <span className="max-w-full truncate">From “{quiz.material.title}”</span> : null}
        </div>

        {quiz.status === "ACTIVE" && quiz.endsAt ? (
          <p className="text-xs font-medium text-success">Ends {formatDateTime(quiz.endsAt)}</p>
        ) : null}
        {!isStaff && attempt && attempt.status !== "IN_PROGRESS" && attempt.percentage !== null ? (
          <Badge variant="secondary" className="w-fit">
            Score {attempt.score}/{attempt.totalQuestions} · {attempt.percentage}%
          </Badge>
        ) : null}
        {isStaff ? (
          <p className="text-muted-foreground text-xs">{quiz._count.attempts} attempt(s)</p>
        ) : null}

        <div className="mt-auto pt-1">{action}</div>
      </CardContent>
    </Card>
  );
}

const DURATIONS = ["10", "15", "20", "30", "45", "60"];

const createQuizSchema = z.object({
  title: z.string().trim().min(3, { error: "Title must be at least 3 characters." }).max(150),
  description: z.string().trim().max(1000),
  duration: z.string().refine((v) => /^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 300, { error: "Enter 1 to 300 minutes." }),
  materialId: z.string(),
});

const NO_MATERIAL = "none";

function CreateQuizForm({ offeringId, onDone }: { offeringId: string; onDone: () => void }) {
  const router = useRouter();
  const [serverError, setServerError] = useState<{ message: string; details: string[] } | null>(null);
  const materials = useApiQuery({
    queryKey: queryKeys.course.materials(offeringId),
    queryFn: () => materialApi.list(offeringId),
  });

  const create = useApiMutation({
    mutationFn: (v: z.infer<typeof createQuizSchema>) =>
      quizApi.create(offeringId, {
        title: v.title,
        durationMinutes: Number(v.duration),
        ...(v.description ? { description: v.description } : {}),
        ...(v.materialId !== NO_MATERIAL ? { materialId: v.materialId } : {}),
      }),
    notifyError: false,
    successMessage: "Quiz created as a draft.",
    invalidate: [queryKeys.course.quizzes(offeringId)],
    onSuccess: (quiz) => router.push(`/faculty/quizzes/${quiz.id}`),
  });

  const form = useForm({
    defaultValues: { title: "", description: "", duration: "20", materialId: NO_MATERIAL },
    validators: { onSubmit: createQuizSchema },
    onSubmit: async ({ value }) => {
      setServerError(null);
      try {
        await create.mutateAsync(value);
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

      <form.Field name="title">{(field) => <TextInputField field={field} label="Quiz title" placeholder="e.g. Normalization quiz" />}</form.Field>
      <form.Field name="description">{(field) => <TextInputField field={field} label="Description (optional)" />}</form.Field>

      <form.Field name="duration">
        {(field) => (
          <div className="space-y-2">
            <p className="text-sm font-medium">Quick pick (minutes)</p>
            <div className="flex flex-wrap gap-2" role="group" aria-label="Common durations">
              {DURATIONS.map((d) => (
                <Button key={d} type="button" size="sm" variant={field.state.value === d ? "default" : "outline"} onClick={() => field.handleChange(d)}>
                  {d}
                </Button>
              ))}
            </div>
            <TextInputField field={field} label="Time limit (minutes)" inputMode="numeric" />
          </div>
        )}
      </form.Field>

      <form.Field name="materialId">
        {(field) => (
          <div className="space-y-2">
            <Label htmlFor="quiz-material">Source PDF (optional)</Label>
            <Select value={field.state.value} onValueChange={(value) => field.handleChange(value)}>
              <SelectTrigger id="quiz-material" className="h-10 w-full">
                <SelectValue placeholder="No source PDF" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_MATERIAL}>No source PDF</SelectItem>
                {(materials.data ?? []).map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">The PDF AI questions will be generated from. You can change it later.</p>
          </div>
        )}
      </form.Field>

      <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting] as const}>
        {([canSubmit, isSubmitting]) => (
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onDone}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || isSubmitting} className="bg-brand-gradient text-white hover:opacity-90">
              {isSubmitting ? "Creating…" : "Create draft"}
            </Button>
          </div>
        )}
      </form.Subscribe>
    </form>
  );
}
