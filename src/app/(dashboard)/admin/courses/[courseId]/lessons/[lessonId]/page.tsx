import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../../../convex/_generated/api";
import { Id } from "../../../../../../../../convex/_generated/dataModel";
import { LessonEditor } from "./lesson-editor";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface LessonEditorPageProps {
  params: Promise<{ courseId: string; lessonId: string }>;
}

export default async function LessonEditorPage({ params }: LessonEditorPageProps) {
  const { courseId, lessonId } = await params;
  const { userId, getToken } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const token = await getToken({ template: "convex" });
  convex.setAuth(token!);

  // Check admin role
  const user = await convex.query(api.users.getByClerkId, { clerkId: userId });
  if (!user || user.role !== "admin") {
    redirect("/");
  }

  // Fetch lesson
  const lesson = await convex.query(api.lessons.get, {
    lessonId: lessonId as Id<"lessons">,
  });

  if (!lesson) {
    notFound();
  }

  // Fetch course for breadcrumb
  const course = await convex.query(api.courses.get, {
    courseId: courseId as Id<"courses">,
  });

  if (!course) {
    notFound();
  }

  return (
    <LessonEditor
      lesson={lesson}
      courseId={courseId as Id<"courses">}
      courseTitle={course.title}
    />
  );
}
