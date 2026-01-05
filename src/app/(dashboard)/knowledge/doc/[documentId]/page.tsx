import { type Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { redirect, notFound } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { Id } from "../../../../../../convex/_generated/dataModel";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../../../convex/_generated/api").api;
import { DocumentEditorClient } from "./editor";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// ============================================================================
// Types
// ============================================================================

interface DocumentPageProps {
  params: Promise<{ documentId: string }>;
}

// ============================================================================
// Metadata Generation
// ============================================================================

/**
 * Generate dynamic metadata for SEO based on document title.
 */
export async function generateMetadata({
  params,
}: DocumentPageProps): Promise<Metadata> {
  const { documentId } = await params;
  const { userId, getToken } = await auth();

  if (!userId) {
    return {
      title: "Document | Knowledge Base",
    };
  }

  try {
    const token = await getToken({ template: "convex" });
    convex.setAuth(token!);

    const document = await convex.query(api.knowledge.documents.get, {
      id: documentId as Id<"kbDocuments">,
    });

    if (!document) {
      return {
        title: "Document Not Found | Knowledge Base",
      };
    }

    return {
      title: `${document.title} | Knowledge Base`,
      description: `Edit ${document.title} in the Knowledge Base`,
    };
  } catch {
    return {
      title: "Document | Knowledge Base",
    };
  }
}

// ============================================================================
// Page Component (Server Component)
// ============================================================================

/**
 * Knowledge Base Document Page.
 *
 * Server Component that:
 * - Authenticates the user via Clerk
 * - Fetches document metadata for validation
 * - Renders the client-side editor component
 * - Handles not found and permission denied states
 */
export default async function DocumentPage({
  params,
}: DocumentPageProps): Promise<React.ReactElement> {
  const { documentId } = await params;
  const { userId, getToken } = await auth();

  // Redirect unauthenticated users
  if (!userId) {
    redirect("/sign-in");
  }

  const token = await getToken({ template: "convex" });
  convex.setAuth(token!);

  // Fetch document to validate it exists and user has access
  const document = await convex.query(api.knowledge.documents.get, {
    id: documentId as Id<"kbDocuments">,
  });

  // Document not found or user lacks permission
  if (!document) {
    notFound();
  }

  // Fetch breadcrumbs for navigation
  const breadcrumbs = await convex.query(api.knowledge.documents.getBreadcrumbs, {
    documentId: documentId as Id<"kbDocuments">,
  });

  return (
    <DocumentEditorClient
      documentId={documentId as Id<"kbDocuments">}
      initialDocument={document}
      breadcrumbs={breadcrumbs ?? []}
    />
  );
}
