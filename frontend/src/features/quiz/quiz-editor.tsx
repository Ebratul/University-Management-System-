"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ListChecks, Loader2, Play, Rocket, Undo2, Trash2 } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { quizApi } from "@/lib/api/endpoints";
import { queryKeys } from "@/lib/api/query-keys";
import { formatDateTime } from "@/lib/format";
import { Countdown } from "./quiz-countdown";
import { QuestionEditor } from "./question-editor";
import { QuizResultsPanel } from "./quiz-results-panel";
import { QuizStatusBadge } from "./quiz-status-badge";
import { serverOffset } from "./use-clock";
import type { QuizDetail } from "@/types/entities";

/**
 * Teacher's page for one quiz: details, questions (with AI generation), the
 * lifecycle buttons (publish -> start), and results. Status changes are made by
 * the server; this page only asks for them and shows the outcome.
 */
export function QuizEditor({ quizId }: { quizId: string }) {
  const quiz = useApiQuery({
    queryKey: queryKeys.quiz.detail(quizId),
    queryFn: () => quizApi.get(quizId),
    // An active quiz ends by itself on the server; notice it without a manual refresh.
    refetchInterval: (query) => (query.state.data?.status === "ACTIVE" ? 10_000 : false),
  });

  if (quiz.isPending) {
    return (
      <div className="space-y-6" aria-busy="true">
        <Skeleton className="h-10 w-72" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }
  if (quiz.isError || !quiz.data.questions) {
    return (
      <EmptyState
        icon={ListChecks}
        title="This quiz is not available"
        description={quiz.error?.message ?? "It may have been deleted, or you may not have access."}
        action={
          <Button asChild variant="outline">
            <Link href="/faculty/offerings">Back to my offerings</Link>
          </Button>
        }
      />
    );
  }

  // Remount the workspace when the server state changes under it (publish / unpublish).
  return <QuizEditorBody key={`${quiz.data.id}-${quiz.data.status}`} quiz={quiz.data} receivedAt={quiz.dataUpdatedAt} />;
}

function QuizEditorBody({ quiz, receivedAt }: { quiz: QuizDetail; receivedAt: number }) {
  const router = useRouter();
  const [confirm, setConfirm] = useState<"start" | "delete" | null>(null);
  const editable = quiz.status === "DRAFT";
  const offset = serverOffset(quiz.serverTime, receivedAt);

  const keys = [queryKeys.quiz.detail(quiz.id), queryKeys.course.quizzes(quiz.courseOfferingId)];
  const publish = useApiMutation({ mutationFn: () => quizApi.publish(quiz.id), successMessage: "Quiz published. Start it when you are ready.", invalidate: keys });
  const unpublish = useApiMutation({ mutationFn: () => quizApi.unpublish(quiz.id), successMessage: "Moved back to draft.", invalidate: keys });
  const start = useApiMutation({
    mutationFn: () => quizApi.start(quiz.id),
    successMessage: "Quiz started. Students can take it now.",
    invalidate: keys,
    onSuccess: () => setConfirm(null),
  });
  const remove = useApiMutation({
    mutationFn: () => quizApi.remove(quiz.id),
    successMessage: "Quiz deleted.",
    invalidate: [queryKeys.course.quizzes(quiz.courseOfferingId)],
    onSuccess: () => router.push(`/faculty/offerings/${quiz.courseOfferingId}`),
  });

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb" className="text-muted-foreground text-sm">
        <Link href={`/faculty/offerings/${quiz.courseOfferingId}`} className="hover:text-foreground underline-offset-4 hover:underline">
          Back to course
        </Link>
      </nav>

      <PageHeader
        eyebrow="Quiz"
        title={quiz.title}
        description={quiz.description ?? undefined}
        actions={<QuizStatusBadge status={quiz.status} className="h-7 px-3 text-sm" />}
      />

      <Card>
        <CardContent className="flex-row flex-wrap items-center gap-x-6 gap-y-4">
          <Fact label="Time limit">{quiz.durationMinutes} minutes</Fact>
          <Fact label="Questions">{quiz.questionCount}</Fact>
          <Fact label="Attempts">{quiz.attemptCount}</Fact>
          {quiz.status === "ACTIVE" && quiz.endsAt ? (
            <>
              <Fact label="Ends at">{formatDateTime(quiz.endsAt)}</Fact>
              <Fact label="Time left">
                <Countdown endsAtMs={Date.parse(quiz.endsAt)} offsetMs={offset} />
              </Fact>
            </>
          ) : null}
          {quiz.status === "ENDED" && quiz.endsAt ? <Fact label="Ended">{formatDateTime(quiz.endsAt)}</Fact> : null}

          <div className="ml-auto flex flex-wrap gap-2">
            {quiz.status === "DRAFT" ? (
              <Button disabled={quiz.questionCount === 0 || publish.isPending} onClick={() => publish.mutate()} className="bg-brand-gradient text-white hover:opacity-90">
                {publish.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Rocket className="size-4" aria-hidden="true" />}
                Publish quiz
              </Button>
            ) : null}
            {quiz.status === "UPCOMING" ? (
              <>
                <Button variant="outline" disabled={unpublish.isPending} onClick={() => unpublish.mutate()}>
                  <Undo2 className="size-4" aria-hidden="true" /> Back to draft
                </Button>
                <Button onClick={() => setConfirm("start")} className="bg-success text-white hover:bg-success/90">
                  <Play className="size-4" aria-hidden="true" /> START QUIZ
                </Button>
              </>
            ) : null}
            {quiz.status === "DRAFT" || quiz.status === "UPCOMING" ? (
              <Button variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setConfirm("delete")}>
                <Trash2 className="size-4" aria-hidden="true" /> Delete
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
      {quiz.status === "DRAFT" && quiz.questionCount === 0 ? (
        <p className="text-muted-foreground -mt-3 text-sm">Add and save at least one question to publish.</p>
      ) : null}
      {quiz.status === "UPCOMING" ? (
        <p className="text-muted-foreground -mt-3 text-sm">Published. Students cannot see the questions until you press Start.</p>
      ) : null}

      <Tabs defaultValue={quiz.status === "ACTIVE" || quiz.status === "ENDED" ? "results" : "questions"} className="gap-6">
        <TabsList variant="line" className="h-10 justify-start gap-2 border-b pb-0">
          <TabsTrigger value="questions" className="flex-none px-3">Questions</TabsTrigger>
          <TabsTrigger value="results" className="flex-none px-3">Results</TabsTrigger>
          <TabsTrigger value="details" className="flex-none px-3">Details</TabsTrigger>
        </TabsList>
        <TabsContent value="questions" className="animate-in fade-in-0 duration-200">
          <QuestionEditor quiz={quiz} editable={editable} />
        </TabsContent>
        <TabsContent value="results" className="animate-in fade-in-0 duration-200">
          <QuizResultsPanel quizId={quiz.id} status={quiz.status} />
        </TabsContent>
        <TabsContent value="details" className="animate-in fade-in-0 duration-200">
          <DetailsForm quiz={quiz} editable={quiz.status === "DRAFT" || quiz.status === "UPCOMING"} />
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirm === "start"} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start this quiz now?</AlertDialogTitle>
            <AlertDialogDescription>
              Students in this course can open it immediately and will have {quiz.durationMinutes} minutes. The server closes it automatically when time runs out, and this cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Not yet</AlertDialogCancel>
            <AlertDialogAction
              disabled={start.isPending}
              className="bg-success text-white hover:bg-success/90"
              onClick={(event) => {
                event.preventDefault();
                start.mutate();
              }}
            >
              {start.isPending ? "Starting…" : "Start quiz"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === "delete"} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this quiz?</AlertDialogTitle>
            <AlertDialogDescription>“{quiz.title}” and its questions will be removed permanently.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={remove.isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(event) => {
                event.preventDefault();
                remove.mutate();
              }}
            >
              {remove.isPending ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
      <div className="text-sm font-semibold">{children}</div>
    </div>
  );
}

function DetailsForm({ quiz, editable }: { quiz: QuizDetail; editable: boolean }) {
  const [title, setTitle] = useState(quiz.title);
  const [description, setDescription] = useState(quiz.description ?? "");
  const [duration, setDuration] = useState(String(quiz.durationMinutes));
  const [showAnswers, setShowAnswers] = useState(quiz.showAnswersAfterEnd);

  const minutes = Number(duration);
  const valid = title.trim().length >= 3 && Number.isInteger(minutes) && minutes >= 1 && minutes <= 300;
  const changed =
    title.trim() !== quiz.title || description.trim() !== (quiz.description ?? "") || minutes !== quiz.durationMinutes || showAnswers !== quiz.showAnswersAfterEnd;

  const save = useApiMutation({
    mutationFn: () => quizApi.update(quiz.id, { title: title.trim(), description: description.trim(), durationMinutes: minutes, showAnswersAfterEnd: showAnswers }),
    successMessage: "Details saved.",
    invalidate: [queryKeys.quiz.detail(quiz.id), queryKeys.course.quizzes(quiz.courseOfferingId)],
  });

  return (
    <Card className="max-w-2xl">
      <CardContent className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="quiz-title">Title</Label>
          <Input id="quiz-title" value={title} disabled={!editable} maxLength={150} onChange={(event) => setTitle(event.target.value)} className="h-10" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quiz-description">Description</Label>
          <textarea
            id="quiz-description"
            rows={3}
            value={description}
            disabled={!editable}
            maxLength={1000}
            onChange={(event) => setDescription(event.target.value)}
            className="border-input bg-background focus-visible:border-ring focus-visible:ring-ring/50 disabled:opacity-70 w-full rounded-md border px-3 py-2 text-sm outline-none focus-visible:ring-3"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="quiz-minutes">Time limit (minutes)</Label>
          <Input id="quiz-minutes" inputMode="numeric" value={duration} disabled={!editable} onChange={(event) => setDuration(event.target.value)} aria-invalid={!valid && editable} className="h-10 max-w-40" />
          <p className="text-muted-foreground text-xs">The clock starts when you press Start, and is enforced by the server.</p>
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={showAnswers} disabled={!editable} onChange={(event) => setShowAnswers(event.target.checked)} className="mt-0.5 size-4" />
          <span>
            <span className="font-medium">Show correct answers after the quiz ends</span>
            <span className="text-muted-foreground block text-xs">Students always see their score; the answer key is never shown while the quiz is running.</span>
          </span>
        </label>
        {editable ? (
          <div className="flex justify-end">
            <Button disabled={!valid || !changed || save.isPending} onClick={() => save.mutate()} className="bg-brand-gradient text-white hover:opacity-90">
              {save.isPending ? "Saving…" : "Save details"}
            </Button>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">Details cannot be changed once the quiz has started.</p>
        )}
      </CardContent>
    </Card>
  );
}
