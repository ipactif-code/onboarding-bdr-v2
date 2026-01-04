import { type Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { Id } from "../../../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../../convex/_generated/api").api;
import { WorkspaceView } from "./workspace-view";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// ============================================================================
// Types
// ============================================================================

interface WorkspacePageProps {
  params: Promise<{ workspaceId: string }>;
}

// ============================================================================
// Metadata Generation
// ============================================================================

/**
 * Generate dynamic metadata for SEO based on workspace name.
 */
export async function generateMetadata({
  params,
}: WorkspacePageProps): Promise<Metadata> {
  const { workspaceId } = await params;
  const { userId, getToken } = await auth();

  if (!userId) {
    return {
      title: "Workspace | Knowledge Base",
    };
  }

  try {
    const token = await getToken({ template: "convex" });
    convex.setAuth(token!);

    const workspace = await convex.query(api.knowledge.workspaces.get, {
      id: workspaceId as Id<"kbWorkspaces">,
    });

    if (!workspace) {
      return {
        title: "Workspace Not Found | Knowledge Base",
      };
    }

    return {
      title: `${workspace.name} | Knowledge Base`,
      description: workspace.description ?? `${workspace.name} workspace`,
    };
  } catch {
    return {
      title: "Workspace | Knowledge Base",
    };
  }
}

// ============================================================================
// Page Component (Server Component)
// ============================================================================

/**
 * Knowledge Base Workspace Page.
 *
 * Server Component that:
 * - Authenticates the user via Clerk
 * - Fetches workspace metadata for validation
 * - Renders the client-side workspace view component
 * - Handles not found and permission denied states
 */
export default async function WorkspacePage({
  params,
}: WorkspacePageProps): Promise<React.ReactElement> {
  const { workspaceId } = await params;
  const { userId, getToken } = await auth();

  // Redirect unauthenticated users
  if (!userId) {
    redirect("/sign-in");
  }

  const token = await getToken({ template: "convex" });
  convex.setAuth(token!);

  // Fetch workspace to validate it exists and user has access
  const workspace = await convex.query(api.knowledge.workspaces.get, {
    id: workspaceId as Id<"kbWorkspaces">,
  });

  // Workspace not found or user lacks permission
  if (!workspace) {
    notFound();
  }

  return (
    <WorkspaceView
      workspaceId={workspaceId as Id<"kbWorkspaces">}
      initialWorkspace={workspace}
    />
  );
}
