import type { Metadata } from "next";
import { QuizApp } from "@/components/quiz/quiz-app";
import { getT } from "@/i18n/server";

// Quizen krever ikke innlogging, og service workeren lagrer siden så den virker uten nett.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t.quiz.metaTitle, alternates: { canonical: "/quiz" } };
}

export default function QuizPage() {
  return <QuizApp />;
}
