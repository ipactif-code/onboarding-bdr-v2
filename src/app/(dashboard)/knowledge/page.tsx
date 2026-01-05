import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { KnowledgeHomeView } from "./knowledge-home-view";

/**
 * Knowledge Base home page.
 *
 * Server Component that:
 * - Authenticates the user via Clerk
 * - Renders the client-side home view with workspaces overview
 */
export default async function KnowledgePage(): Promise<React.ReactElement> {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <KnowledgeHomeView />;
}
