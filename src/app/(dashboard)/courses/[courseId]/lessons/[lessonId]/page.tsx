import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

interface LessonPageProps {
  params: Promise<{ courseId: string; lessonId: string }>;
}

export default async function LessonPage({ params }: LessonPageProps) {
  const { courseId, lessonId } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Redirect to SPA-style URL with query param
  redirect(`/courses/${courseId}?lesson=${lessonId}`);
}
