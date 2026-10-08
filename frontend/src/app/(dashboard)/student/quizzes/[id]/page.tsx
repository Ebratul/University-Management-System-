import type { Metadata } from "next";

import { QuizRunner } from "@/features/quiz/quiz-runner";

export const metadata: Metadata = {
  title: "Quiz",
};

export default async function StudentQuizPage({ params }: PageProps<"/student/quizzes/[id]">) {
  const { id } = await params;
  return <QuizRunner quizId={id} />;
}
