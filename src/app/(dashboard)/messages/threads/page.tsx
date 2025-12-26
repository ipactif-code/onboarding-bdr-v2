import { use } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ThreadsView } from "./threads-view";

/**
 * Threads page displaying all messages with recent thread activity.
 *
 * Server Component that handles authentication and renders the ThreadsView.
 * Shows threads from all channels the user has access to, sorted by most
 * recent activity.
 *
 * Route: /messages/threads
 */
export default function ThreadsPage(): React.ReactElement {
  // Check authentication on the server
  const { userId } = use(auth());
  if (!userId) {
    redirect("/sign-in");
  }

  return <ThreadsView />;
}
