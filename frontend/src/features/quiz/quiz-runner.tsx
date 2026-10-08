"use client";

import { useRef, useState } from "react";
import { useEffect } from "react";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, Clock, Hourglass, ListChecks, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { FormAlert } from "@/components/forms/form-alert";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useApiMutation } from "@/hooks/use-api-mutation";
import { useApiQuery } from "@/hooks/use-api-query";
import { quizApi } from "@/lib/api/endpoints";
import { toApiError } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MyQuizResult, QuizAttemptStart, QuizChoice } from "@/types/entities";
import { CHOICES, optionField } from "./question-model";
import { Countdown } from "./quiz-countdown";
import { serverOffset, useNow } from "./use-clock";

/**
 * The student's whole quiz journey on one route: waiting for the teacher to
 * start, the intro, the timed attempt, and the result. Every deadline decision
 * is the server's; the countdown here only mirrors it.
 */
export function QuizRunner({ quizId }: { quizId: string }) {
  const [session, setSession] = useState<{ data: QuizAttemptStart; receivedAt: number } | null>(null);
  const [finished, setFinished] = useState<{ timeOver: boolean } | null>(null);

  const quiz = useApiQuery({
    queryKey: queryKeys.quiz.detail(quizId),
    queryFn: () => quizApi.get(quizId),
    // Notice the teacher pressing Start (or the quiz ending) without a manual refresh.
    refetchInterval: (query) => {
      if (session || finished) return false;
      const status = query.state.data?.status;
      return status === "UPCOMING" ? 5_000 : status === "ACTIVE" ? 15_000 : false;
    },
  });

  const begin = useApiMutation({
    mutationFn: () => quizApi.begin(quizId),
    notifyError: false,
    onSuccess: (data) => setSession({ data, receivedAt: Date.now() }),
  });

  if (quiz.isPending) return <Skeleton className="mx-auto h-80 max-w-3xl rounded-2xl" />;

  if (quiz.isError) {
    return (
      <EmptyState
        icon={ListChecks}
        title="This quiz is not available"
        description={quiz.error.message}
        action={
          <Button asChild variant="outline">
            <Link href="/student/enrollments">Back to my courses</Link>
          </Button>
        }
      />
    );
  }

  const q = quiz.data;
  const back = (
    <Button asChild variant="outline">
      <Link href={`/student/offerings/${q.courseOfferingId}`}>Back to course</Link>
    </Button>
  );

  if (session && !finished) {
    return (
      <QuizSession
        quizId={quizId}
        initial={session.data}
        receivedAt={session.receivedAt}
        onFinish={(timeOver) => setFinished({ timeOver })}
      />
    );
  }

  const attempt = q.myAttempt;
  if (finished || (attempt && attempt.status !== "IN_PROGRESS")) {
    return <ResultView quizId={quizId} courseId={q.courseOfferingId} timeOver={finished?.timeOver ?? attempt?.status === "AUTO_SUBMITTED"} />;
  }

  if (q.status === "UPCOMING") {
    return (
      <div className="mx-auto max-w-xl pt-8">
        <EmptyState icon={Hourglass} title="Quiz has not started yet." description={`“${q.title}” will open here as soon as your teacher starts it. This page updates by itself.`} action={back} />
      </div>
    );
  }

  if (q.status === "ENDED" || q.status === "DRAFT") {
    return (
      <div className="mx-auto max-w-xl pt-8">
        <EmptyState icon={Clock} title={q.status === "ENDED" ? "This quiz has ended." : "Quiz not available"} description={q.status === "ENDED" ? "You did not take it before time ran out." : undefined} action={back} />
      </div>
    );
  }

  // ACTIVE and not yet submitted: intro screen.
  const resuming = attempt?.status === "IN_PROGRESS";
  return (
    <div className="mx-auto max-w-2xl space-y-6 pt-4">
      <Card className="overflow-hidden">
        <div className="bg-brand-gradient px-6 py-8 text-white">
          <Badge className="mb-3 border-transparent bg-white/20 text-white">Quiz</Badge>
          <h1 className="text-2xl font-bold text-balance sm:text-3xl">{q.title}</h1>
          {q.description ? <p className="mt-2 text-white/85">{q.description}</p> : null}
        </div>
        <CardContent className="space-y-5">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Questions</dt>
              <dd className="text-lg font-semibold">{q.questionCount}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Time limit</dt>
              <dd className="text-lg font-semibold">{q.durationMinutes} minutes</dd>
            </div>
          </dl>
          {q.endsAt ? (
            <p className="bg-warning/15 rounded-lg px-3 py-2 text-sm">
              The quiz closes for everyone at <strong>{formatDateTime(q.endsAt)}</strong>, whether or not you have finished. Answers are saved as you go.
            </p>
          ) : null}
          {begin.isError ? <FormAlert message={begin.error.message} details={[]} /> : null}
          <Button size="lg" disabled={begin.isPending} onClick={() => begin.mutate()} className="bg-brand-gradient h-12 w-full text-base text-white hover:opacity-90">
            {begin.isPending ? (
              <>
                <Loader2 className="size-5 animate-spin" aria-hidden="true" /> Starting…
              </>
            ) : resuming ? (
              "Continue quiz"
            ) : (
              "Start quiz"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ------------------------------- Attempt --------------------------------

function QuizSession({
  quizId,
  initial,
  receivedAt,
  onFinish,
}: {
  quizId: string;
  initial: QuizAttemptStart;
  receivedAt: number;
  onFinish: (timeOver: boolean) => void;
}) {
  const { questions, quiz } = initial;
  const [answers, setAnswers] = useState<Record<string, QuizChoice>>(initial.answers);
  const [index, setIndex] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const finishing = useRef(false);

  const offset = serverOffset(initial.serverTime, receivedAt);
  const endsAtMs = Date.parse(quiz.endsAt);
  const now = useNow(1000);
  const expired = endsAtMs - (now + offset) <= 0;

  const current = questions[index];
  const answeredCount = questions.filter((qn) => answers[qn.id]).length;
  const unanswered = questions.length - answeredCount;

  // Sends everything once. Server says "time is over" -> it has already scored
  // what was saved; we then just fetch that result.
  async function finish() {
    if (finishing.current) return;
    finishing.current = true;
    setSubmitting(true);
    try {
      await quizApi.submit(quizId, Object.entries(answers).map(([questionId, selected]) => ({ questionId, selected })));
      onFinish(false);
    } catch (error) {
      const apiError = toApiError(error);
      if (apiError.status === 409) {
        onFinish(/time is over/i.test(apiError.message));
      } else {
        finishing.current = false;
        setSubmitting(false);
        toast.error(apiError.message);
      }
    }
  }

  // When the clock reaches zero, submit what we have. The latest `finish` is
  // kept in a ref so the effect only reacts to `expired` flipping.
  const finishRef = useRef(finish);
  useEffect(() => {
    finishRef.current = finish;
  });
  useEffect(() => {
    if (expired) void finishRef.current();
  }, [expired]);

  function choose(questionId: string, selected: QuizChoice) {
    setAnswers((a) => ({ ...a, [questionId]: selected }));
    // Autosave each answer, so an expiry still scores what was done.
    quizApi.saveAnswers(quizId, [{ questionId, selected }]).catch((error) => {
      if (toApiError(error).status === 409) void finishRef.current();
    });
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="bg-background/95 sticky top-0 z-20 -mx-4 border-b px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{quiz.title}</p>
            <p className="text-muted-foreground text-xs">
              Question {index + 1} of {questions.length} · {answeredCount} answered
            </p>
          </div>
          <Countdown endsAtMs={endsAtMs} offsetMs={offset} className="text-base" />
        </div>
        <Progress value={((index + 1) / questions.length) * 100} aria-label="Question progress" className="mt-3" />
      </div>

      {expired ? (
        <div role="alert" className="bg-destructive/10 text-destructive rounded-lg p-4 text-center font-medium">
          <Loader2 className="mr-2 inline size-4 animate-spin" aria-hidden="true" />
          Time is over. Submitting your answers…
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_16rem]">
        <Card key={current.id} className="animate-in fade-in-0 slide-in-from-right-3 duration-200">
          <CardContent className="space-y-6">
            <h2 className="text-lg leading-snug font-semibold text-balance sm:text-xl">
              <span className="text-muted-foreground mr-2 font-mono text-base">{index + 1}.</span>
              {current.question}
            </h2>

            <div role="radiogroup" aria-label={`Answer for question ${index + 1}`} className="space-y-3">
              {CHOICES.map((c) => {
                const selected = answers[current.id] === c;
                return (
                  <button
                    key={c}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    disabled={expired || submitting}
                    onClick={() => choose(current.id, c)}
                    className={cn(
                      "focus-visible:ring-ring/50 flex min-h-14 w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition-all outline-none focus-visible:ring-3 sm:text-base",
                      selected ? "border-primary bg-primary/10 shadow-sm" : "hover:border-primary/50 hover:bg-muted/60",
                      (expired || submitting) && "opacity-60",
                    )}
                  >
                    <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-full border font-mono text-sm font-semibold", selected ? "border-primary bg-primary text-primary-foreground" : "text-muted-foreground")}>
                      {selected ? <Check className="size-4" aria-hidden="true" /> : c}
                    </span>
                    <span className="min-w-0 break-words">{current[optionField[c]]}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <Button variant="outline" disabled={index === 0 || submitting} onClick={() => setIndex((i) => i - 1)}>
                <ChevronLeft className="size-4" aria-hidden="true" /> Previous
              </Button>
              {index < questions.length - 1 ? (
                <Button disabled={submitting} onClick={() => setIndex((i) => i + 1)}>
                  Next <ChevronRight className="size-4" aria-hidden="true" />
                </Button>
              ) : (
                <Button disabled={expired || submitting} onClick={() => setConfirming(true)} className="bg-brand-gradient text-white hover:opacity-90">
                  <Send className="size-4" aria-hidden="true" /> Submit quiz
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <aside aria-label="Question navigator" className="space-y-4">
          <Card>
            <CardContent className="space-y-3">
              <p className="text-sm font-semibold">Questions</p>
              <ol className="grid grid-cols-5 gap-2">
                {questions.map((qn, i) => {
                  const answered = Boolean(answers[qn.id]);
                  return (
                    <li key={qn.id}>
                      <button
                        type="button"
                        onClick={() => setIndex(i)}
                        aria-label={`Question ${i + 1}, ${answered ? "answered" : "not answered"}${i === index ? ", current" : ""}`}
                        aria-current={i === index ? "step" : undefined}
                        className={cn(
                          "focus-visible:ring-ring/50 flex h-9 w-full items-center justify-center rounded-lg border text-sm font-medium tabular-nums transition-colors outline-none focus-visible:ring-3",
                          answered ? "border-success/50 bg-success/15 text-success" : "text-muted-foreground hover:bg-muted",
                          i === index && "ring-primary ring-2",
                        )}
                      >
                        {i + 1}
                      </button>
                    </li>
                  );
                })}
              </ol>
              <p className="text-muted-foreground text-xs">
                <span className="bg-success/40 mr-1 inline-block size-2 rounded-full align-middle" /> answered
                <span className="bg-muted-foreground/30 mr-1 ml-3 inline-block size-2 rounded-full align-middle" /> not yet
              </p>
            </CardContent>
          </Card>
          <Button variant="outline" className="w-full" disabled={expired || submitting} onClick={() => setConfirming(true)}>
            <Send className="size-4" aria-hidden="true" /> Submit quiz
          </Button>
        </aside>
      </div>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit your quiz?</AlertDialogTitle>
            <AlertDialogDescription>
              {unanswered > 0 ? `You still have ${unanswered} unanswered question${unanswered === 1 ? "" : "s"}. Are you sure you want to submit?` : "You have answered every question. You cannot change your answers after submitting."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep working</AlertDialogCancel>
            <AlertDialogAction
              disabled={submitting}
              onClick={(event) => {
                event.preventDefault();
                setConfirming(false);
                void finish();
              }}
            >
              {submitting ? "Submitting…" : "Submit"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// -------------------------------- Result ---------------------------------

function ResultView({ quizId, courseId, timeOver }: { quizId: string; courseId: string; timeOver: boolean }) {
  const result = useApiQuery({
    queryKey: queryKeys.quiz.myResult(quizId),
    queryFn: () => quizApi.myResult(quizId),
    // The answer key unlocks when the quiz ends: keep checking until it does.
    refetchInterval: (query) => (query.state.data && !query.state.data.quizEnded ? 15_000 : false),
  });

  if (result.isPending) return <Skeleton className="mx-auto h-80 max-w-3xl rounded-2xl" />;
  if (result.isError) {
    return <EmptyState icon={ListChecks} title="Could not load your result" description={result.error.message} action={<Button variant="outline" onClick={() => void result.refetch()}>Try again</Button>} />;
  }
  const r = result.data;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {timeOver ? (
        <div role="alert" className="bg-warning/20 rounded-xl p-4 text-center font-medium">
          Time is over. Your quiz has ended.
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className="bg-brand-gradient px-6 py-6 text-white">
          <p className="text-sm text-white/80">Result</p>
          <h1 className="text-2xl font-bold text-balance">{r.quizTitle}</h1>
        </div>
        <CardContent className="grid items-center gap-6 sm:grid-cols-[auto_1fr]">
          <ScoreRing percentage={r.percentage} />
          <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <Stat label="Score" value={`${r.score} / ${r.totalQuestions}`} />
            <Stat label="Correct" value={r.correct} tone="success" />
            <Stat label="Wrong" value={r.wrong} tone="danger" />
            <Stat label="Percentage" value={`${r.percentage}%`} />
            {r.submittedAt ? (
              <div className="col-span-2 sm:col-span-4">
                <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Submitted</dt>
                <dd>{formatDateTime(r.submittedAt)}</dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      {r.review ? <ReviewList review={r.review} /> : <p className="text-muted-foreground text-center text-sm">{r.quizEnded ? "Your teacher chose not to show the answers for this quiz." : "The correct answers will be shown after the quiz ends for everyone."}</p>}

      <div className="flex justify-center">
        <Button asChild variant="outline">
          <Link href={`/student/offerings/${courseId}`}>Back to course</Link>
        </Button>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: "success" | "danger" }) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</dt>
      <dd className={cn("text-xl font-bold tabular-nums", tone === "success" && "text-success", tone === "danger" && "text-destructive")}>{value}</dd>
    </div>
  );
}

function ScoreRing({ percentage }: { percentage: number }) {
  return (
    <div
      role="img"
      aria-label={`${percentage} percent`}
      className="relative mx-auto size-32 rounded-full"
      style={{ background: `conic-gradient(var(--success) ${percentage}%, var(--muted) 0)` }}
    >
      <div className="bg-card absolute inset-3 flex items-center justify-center rounded-full text-2xl font-bold tabular-nums">{Math.round(percentage)}%</div>
    </div>
  );
}

function ReviewList({ review }: { review: NonNullable<MyQuizResult["review"]> }) {
  return (
    <section aria-labelledby="review-heading" className="space-y-4">
      <h2 id="review-heading" className="text-lg font-semibold">
        Review
      </h2>
      <ol className="space-y-4">
        {review.map((q, i) => (
          <li key={q.id}>
            <Card>
              <CardContent className="space-y-3">
                <p className="flex items-start gap-2 font-medium">
                  {q.isCorrect ? <Check className="text-success mt-0.5 size-5 shrink-0" aria-label="Correct" /> : <X className="text-destructive mt-0.5 size-5 shrink-0" aria-label="Wrong" />}
                  <span>
                    {i + 1}. {q.question}
                  </span>
                </p>
                <ul className="space-y-1.5">
                  {CHOICES.map((c) => {
                    const isCorrect = q.correctAnswer === c;
                    const isPicked = q.selectedAnswer === c;
                    return (
                      <li key={c} className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm", isCorrect && "border-success bg-success/10", isPicked && !isCorrect && "border-destructive bg-destructive/10")}>
                        <span className="font-mono font-semibold">{c}.</span>
                        <span className="min-w-0 break-words">{q[optionField[c]]}</span>
                        <span className="ml-auto shrink-0 text-xs font-medium">{isCorrect ? "Correct answer" : isPicked ? "Your answer" : ""}</span>
                      </li>
                    );
                  })}
                </ul>
                {!q.selectedAnswer ? <p className="text-muted-foreground text-xs">You did not answer this question.</p> : null}
                {q.explanation ? (
                  <p className="text-muted-foreground text-sm">
                    <strong className="text-foreground">Why: </strong>
                    {q.explanation}
                    {q.sourceReference ? <span className="ml-1 italic">({q.sourceReference})</span> : null}
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}
