import type { Metadata } from "next";

import { QuizEditor } from "@/features/quiz/quiz-editor";

export const metadata: Metadata = {
  title: "Quiz",
};

export default async function FacultyQuizPage({ params }: PageProps<"/faculty/quizzes/[id]">) {
  const { id } = await params;
  return <QuizEditor quizId={id} />;
}
