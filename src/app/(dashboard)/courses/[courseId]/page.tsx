import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CoursePageContent } from "./course-page-content";

interface CoursePageProps {
  params: Promise<{ courseId: string }>;
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { courseId } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <CoursePageContent courseId={courseId} />;
}
