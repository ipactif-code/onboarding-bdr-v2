import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { CourseEditor } from "./course-editor";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface CourseEditorPageProps {
  params: Promise<{ courseId: string }>;
}

export default async function CourseEditorPage({ params }: CourseEditorPageProps) {
  const { courseId } = await params;
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

  // Fetch course
  const course = await convex.query(api.courses.get, {
    courseId: courseId as Id<"courses">,
  });

  if (!course) {
    notFound();
  }

  return <CourseEditor course={course} />;
}
