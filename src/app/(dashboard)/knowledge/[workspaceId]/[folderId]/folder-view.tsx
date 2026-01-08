"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import {
  ChevronRight,
  FileText,
  FolderClosed,
  FolderPlus,
  MoreHorizontal,
  Plus,
  Star,
  Trash2,
} from "lucide-react";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../../../convex/_generated/api").api;
import { Id } from "../../../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ============================================================================
// Types
// ============================================================================

interface FolderViewProps {
  workspaceId: Id<"kbWorkspaces">;
  folderId: Id<"kbFolders">;
  initialFolder: {
    _id: Id<"kbFolders">;
    name: string;
    icon?: string;
    workspaceId: Id<"kbWorkspaces">;
    parentId?: Id<"kbFolders">;
  };
  initialWorkspace: {
    _id: Id<"kbWorkspaces">;
    name: string;
    userPermission: "none" | "read" | "write" | "admin" | null;
  };
  initialBreadcrumbs: Array<{
    _id: Id<"kbFolders">;
    name: string;
    icon?: string;
  }>;
}

interface Folder {
  _id: Id<"kbFolders">;
  name: string;
  icon?: string;
  displayOrder: number;
  isArchived: boolean;
  createdAt: number;
}

interface Document {
  _id: Id<"kbDocuments">;
  title: string;
  icon?: string;
  status: "draft" | "published" | "archived";
  displayOrder: number;
  createdAt: number;
  updatedAt: number;
}

interface BreadcrumbData {
  _id: Id<"kbFolders">;
  name: string;
  icon?: string;
}

// ============================================================================
// Sub-Folder Card Component
// ============================================================================

interface SubFolderCardProps {
  folder: Folder;
  workspaceId: Id<"kbWorkspaces">;
  canWrite: boolean;
  onArchive: (folderId: Id<"kbFolders">) => Promise<void>;
}

function SubFolderCard({
  folder,
  workspaceId,
  canWrite,
  onArchive,
}: SubFolderCardProps): React.ReactElement {
  return (
    <Link href={`/knowledge/${workspaceId}/${folder._id}`}>
      <Card className="group cursor-pointer transition-all hover:border-primary hover:shadow-md">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
              {folder.icon ? (
                <span className="text-lg">{folder.icon}</span>
              ) : (
                <FolderClosed className="size-5 text-muted-foreground" />
              )}
            </div>
            <CardTitle className="truncate text-base group-hover:text-primary transition-colors">
              {folder.name}
            </CardTitle>
          </div>
          {canWrite && (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="opacity-0 group-hover:opacity-100 focus:opacity-100"
                    onClick={(e) => e.preventDefault()}
                  />
                }
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.preventDefault();
                    onArchive(folder._id);
                  }}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 size-4" />
                  Archive
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </CardHeader>
      </Card>
    </Link>
  );
}

// ============================================================================
// Document Favorite Button Component
// ============================================================================

interface DocumentFavoriteButtonProps {
  documentId: Id<"kbDocuments">;
}

function DocumentFavoriteButton({ documentId }: DocumentFavoriteButtonProps): React.ReactElement {
  const isFavorite = useQuery(api.knowledge.documents.isFavorite, { documentId });
  const addFavorite = useMutation(api.knowledge.documents.addFavorite);
  const removeFavorite = useMutation(api.knowledge.documents.removeFavorite);

  const handleToggle = async (e: React.MouseEvent): Promise<void> => {
    e.preventDefault();
    e.stopPropagation();

    try {
      if (isFavorite) {
        await removeFavorite({ documentId });
        toast.success("Removed from favorites");
      } else {
        await addFavorite({ documentId });
        toast.success("Added to favorites");
      }
    } catch {
      toast.error("Failed to update favorites");
    }
  };

  // Show loading state while checking favorite status
  if (isFavorite === undefined) {
    return (
      <Button
        variant="ghost"
        size="icon-xs"
        className="size-6 shrink-0 opacity-0 group-hover:opacity-100"
        disabled
        aria-label="Loading favorite status"
      >
        <Star className="size-4 text-muted-foreground" />
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon-xs"
      onClick={handleToggle}
      className={cn(
        "size-6 shrink-0",
        isFavorite ? "opacity-100" : "opacity-0 group-hover:opacity-100"
      )}
      aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
    >
      <Star
        className={cn(
          "size-4",
          isFavorite ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"
        )}
      />
    </Button>
  );
}

// ============================================================================
// Document Row Component
// ============================================================================

interface DocumentRowProps {
  document: Document;
  canWrite: boolean;
  onArchive: (documentId: Id<"kbDocuments">) => Promise<void>;
}

function DocumentRow({
  document,
  canWrite,
  onArchive,
}: DocumentRowProps): React.ReactElement {
  const statusColors = {
    draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    published: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    archived: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
  };

  return (
    <Link href={`/knowledge/doc/${document._id}`}>
      <div className="group flex items-center gap-3 rounded-lg border p-3 transition-all hover:border-primary hover:bg-muted/50">
        <div className="flex size-8 items-center justify-center rounded-md bg-muted">
          {document.icon ? (
            <span className="text-sm">{document.icon}</span>
          ) : (
            <FileText className="size-4 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium group-hover:text-primary transition-colors">
              {document.title}
            </span>
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
                statusColors[document.status]
              )}
            >
              {document.status}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Updated {new Date(document.updatedAt).toLocaleDateString()}
          </p>
        </div>
        {/* Favorite toggle button */}
        <DocumentFavoriteButton documentId={document._id} />
        {canWrite && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="opacity-0 group-hover:opacity-100 focus:opacity-100"
                  onClick={(e) => e.preventDefault()}
                />
              }
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.preventDefault();
                  onArchive(document._id);
                }}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="mr-2 size-4" />
                Archive
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        <ChevronRight className="size-4 text-muted-foreground" />
      </div>
    </Link>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function FolderViewSkeleton(): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* Breadcrumb skeleton */}
      <Skeleton className="h-5 w-64" />

      {/* Header skeleton */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="size-12 rounded-lg" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Sub-folders skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-24" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </div>

      {/* Documents skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Folder View Component
// ============================================================================

/**
 * Client-side view component for a folder.
 *
 * Displays:
 * - Breadcrumb navigation
 * - Folder header with name and icon
 * - Child folders grid
 * - Documents list
 * - Create folder/document actions
 */
export function FolderView({
  workspaceId,
  folderId,
  initialFolder,
  initialWorkspace,
  initialBreadcrumbs,
}: FolderViewProps): React.ReactElement {
  const router = useRouter();

  // Real-time folder data
  const folder = useQuery(api.knowledge.folders.get, { id: folderId });

  // Real-time breadcrumbs
  const breadcrumbs = useQuery(api.knowledge.folders.getBreadcrumbs, {
    folderId,
  });

  // Child folders
  const childFolders = useQuery(api.knowledge.folders.list, {
    workspaceId,
    parentId: folderId,
  });

  // Documents in this folder
  const documentsResult = useQuery(api.knowledge.documents.list, {
    folderId,
  });

  // Mutations
  const createFolder = useMutation(api.knowledge.folders.create);
  const archiveFolder = useMutation(api.knowledge.folders.archive);
  const createDocument = useMutation(api.knowledge.documents.create);
  const archiveDocument = useMutation(api.knowledge.documents.archive);

  // Use real-time data or fall back to initial
  const currentFolder = folder ?? initialFolder;
  const currentBreadcrumbs = breadcrumbs ?? initialBreadcrumbs;
  const documents = documentsResult?.documents ?? [];

  // Permissions
  const canWrite =
    initialWorkspace.userPermission === "write" ||
    initialWorkspace.userPermission === "admin";

  // Handlers
  const handleCreateFolder = async (): Promise<void> => {
    try {
      await createFolder({
        name: "New Folder",
        workspaceId,
        parentId: folderId,
      });
      toast.success("Folder created");
    } catch {
      toast.error("Failed to create folder");
    }
  };

  const handleArchiveFolder = async (id: Id<"kbFolders">): Promise<void> => {
    try {
      await archiveFolder({ id });
      toast.success("Folder archived");
    } catch {
      toast.error("Failed to archive folder");
    }
  };

  const handleCreateDocument = async (): Promise<void> => {
    try {
      const documentId = await createDocument({
        title: "Untitled",
        folderId,
      });
      toast.success("Document created");
      router.push(`/knowledge/doc/${documentId}`);
    } catch {
      toast.error("Failed to create document");
    }
  };

  const handleArchiveDocument = async (id: Id<"kbDocuments">): Promise<void> => {
    try {
      await archiveDocument({ id });
      toast.success("Document archived");
    } catch {
      toast.error("Failed to archive document");
    }
  };

  // Loading state
  if (childFolders === undefined || documentsResult === undefined) {
    return <FolderViewSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb Navigation */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/knowledge">Knowledge Base</Link>} />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink
              render={
                <Link href={`/knowledge/${workspaceId}`}>
                  {initialWorkspace.name}
                </Link>
              }
            />
          </BreadcrumbItem>
          {currentBreadcrumbs.map((crumb: BreadcrumbData, index: number) => (
            <React.Fragment key={crumb._id}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {index === currentBreadcrumbs.length - 1 ? (
                  <BreadcrumbPage>
                    {crumb.icon ?? ""} {crumb.name}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink
                    render={
                      <Link href={`/knowledge/${workspaceId}/${crumb._id}`}>
                        {crumb.icon ?? ""} {crumb.name}
                      </Link>
                    }
                  />
                )}
              </BreadcrumbItem>
            </React.Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>

      {/* Folder Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-lg bg-muted">
            {currentFolder.icon ? (
              <span className="text-xl">{currentFolder.icon}</span>
            ) : (
              <FolderClosed className="size-6 text-muted-foreground" />
            )}
          </div>
          <h1 className="text-2xl font-semibold text-foreground">
            {currentFolder.name}
          </h1>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCreateFolder}>
              <FolderPlus className="mr-2 size-4" />
              New Folder
            </Button>
            <Button onClick={handleCreateDocument}>
              <Plus className="mr-2 size-4" />
              New Document
            </Button>
          </div>
        )}
      </div>

      {/* Child Folders Section */}
      {childFolders.length > 0 && (
        <section aria-labelledby="subfolders-heading">
          <h2
            id="subfolders-heading"
            className="mb-4 text-lg font-semibold text-foreground"
          >
            Folders
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {childFolders.map((subfolder: Folder) => (
              <SubFolderCard
                key={subfolder._id}
                folder={subfolder}
                workspaceId={workspaceId}
                canWrite={canWrite}
                onArchive={handleArchiveFolder}
              />
            ))}
          </div>
        </section>
      )}

      {/* Documents Section */}
      <section aria-labelledby="documents-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="documents-heading"
            className="text-lg font-semibold text-foreground"
          >
            Documents
          </h2>
        </div>

        {documents.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="size-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                No documents yet. Create one to get started.
              </p>
              {canWrite && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={handleCreateDocument}
                >
                  <Plus className="mr-2 size-4" />
                  Create Document
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {documents.map((document: Document) => (
              <DocumentRow
                key={document._id}
                document={document}
                canWrite={canWrite}
                onArchive={handleArchiveDocument}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
