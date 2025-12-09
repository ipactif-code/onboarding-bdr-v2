import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { ConvexHttpClient } from "convex/browser";
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { CourseContent } from "./course-content";
import { CourseSidebar } from "./course-sidebar";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface CoursePageProps {
  params: Promise<{ courseId: string }>;
}

export default async function CoursePage({ params }: CoursePageProps) {
  const { courseId } = await params;
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  // Fetch course with progress data
  const course = await convex.query(api.courses.getWithProgress, {
    courseId: courseId as Id<"courses">,
  });

  if (!course) {
    notFound();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[2.75fr_1fr] h-[calc(100vh-4rem)]">
      <CourseContent course={course} />
      <CourseSidebar course={course} />
    </div>
  );
}
