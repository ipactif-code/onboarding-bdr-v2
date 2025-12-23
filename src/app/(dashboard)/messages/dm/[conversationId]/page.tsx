import { use } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { DMView } from "./dm-view";

/**
 * Direct Message conversation page.
 *
 * Server Component that handles authentication and renders the DMView.
 * The conversationId is extracted from the URL params.
 *
 * Route: /messages/dm/[conversationId]
 */
export default function DMPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}): React.ReactElement {
  // Resolve the params promise
  const { conversationId } = use(params);

  // Check authentication on the server
  const { userId } = use(auth());
  if (!userId) {
    redirect("/sign-in");
  }

  return <DMView conversationId={conversationId} />;
}
