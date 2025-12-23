import { use } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ChannelView } from "./channel-view";

/**
 * Channel messaging page.
 *
 * Server Component that handles authentication and renders the ChannelView.
 * The channelId is extracted from the URL params.
 *
 * Route: /messages/[channelId]
 */
export default function ChannelPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}): React.ReactElement {
  // Resolve the params promise
  const { channelId } = use(params);

  // Check authentication on the server
  const { userId } = use(auth());
  if (!userId) {
    redirect("/sign-in");
  }

  return <ChannelView channelId={channelId} />;
}
