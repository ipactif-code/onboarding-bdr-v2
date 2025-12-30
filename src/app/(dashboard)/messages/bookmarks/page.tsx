import { use } from "react";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { BookmarksView } from "./bookmarks-view";

/**
 * Bookmarks page displaying the user's bookmarked messages.
 *
 * Server Component that handles authentication and renders the BookmarksView.
 * Shows all messages the user has bookmarked across channels and DMs.
 *
 * Route: /messages/bookmarks
 */
export default function BookmarksPage(): React.ReactElement {
  // Check authentication on the server
  const { userId } = use(auth());
  if (!userId) {
    redirect("/sign-in");
  }

  return <BookmarksView />;
}
