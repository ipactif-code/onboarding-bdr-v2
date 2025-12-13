import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { LessonPageContent } from "./lesson-page-content";

interface LessonPageProps {
  params: Promise<{ courseId: string; lessonId: string }>;
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { courseId, lessonId } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <LessonPageContent courseId={courseId} lessonId={lessonId} />;
}
