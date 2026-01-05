import { type Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { Id } from "../../../../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../../../convex/_generated/api").api;
import { FolderView } from "./folder-view";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// ============================================================================
// Types
// ============================================================================

interface FolderPageProps {
  params: Promise<{ workspaceId: string; folderId: string }>;
}

// ============================================================================
// Metadata Generation
// ============================================================================

/**
 * Generate dynamic metadata for SEO based on folder name.
 */
export async function generateMetadata({
  params,
}: FolderPageProps): Promise<Metadata> {
  const { folderId } = await params;
  const { userId, getToken } = await auth();

  if (!userId) {
    return {
      title: "Folder | Knowledge Base",
    };
  }

  try {
    const token = await getToken({ template: "convex" });
    convex.setAuth(token!);

    const folder = await convex.query(api.knowledge.folders.get, {
      id: folderId as Id<"kbFolders">,
    });

    if (!folder) {
      return {
        title: "Folder Not Found | Knowledge Base",
      };
    }

    return {
      title: `${folder.name} | Knowledge Base`,
      description: `${folder.name} folder in Knowledge Base`,
    };
  } catch {
    return {
      title: "Folder | Knowledge Base",
    };
  }
}

// ============================================================================
// Page Component (Server Component)
// ============================================================================

/**
 * Knowledge Base Folder Page.
 *
 * Server Component that:
 * - Authenticates the user via Clerk
 * - Fetches folder metadata for validation
 * - Fetches breadcrumbs for navigation
 * - Renders the client-side folder view component
 * - Handles not found and permission denied states
 */
export default async function FolderPage({
  params,
}: FolderPageProps): Promise<React.ReactElement> {
  const { workspaceId, folderId } = await params;
  const { userId, getToken } = await auth();

  // Redirect unauthenticated users
  if (!userId) {
    redirect("/sign-in");
  }

  const token = await getToken({ template: "convex" });
  convex.setAuth(token!);

  // Fetch folder to validate it exists and user has access
  const folder = await convex.query(api.knowledge.folders.get, {
    id: folderId as Id<"kbFolders">,
  });

  // Folder not found or user lacks permission
  if (!folder) {
    notFound();
  }

  // Fetch workspace for context
  const workspace = await convex.query(api.knowledge.workspaces.get, {
    id: workspaceId as Id<"kbWorkspaces">,
  });

  if (!workspace) {
    notFound();
  }

  // Fetch breadcrumbs for navigation
  const breadcrumbs = await convex.query(api.knowledge.folders.getBreadcrumbs, {
    folderId: folderId as Id<"kbFolders">,
  });

  return (
    <FolderView
      workspaceId={workspaceId as Id<"kbWorkspaces">}
      folderId={folderId as Id<"kbFolders">}
      initialFolder={folder}
      initialWorkspace={workspace}
      initialBreadcrumbs={breadcrumbs ?? []}
    />
  );
}
