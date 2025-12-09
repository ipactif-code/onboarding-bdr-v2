import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { MessagesView } from "./messages-view";

export default async function MessagesPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <MessagesView />;
}
