import type { ReactElement } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { CoursesList } from "./courses-list";

export default async function CoursesPage(): Promise<ReactElement> {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <CoursesList />;
}
