"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import {
  BookOpen,
  FileText,
  FolderClosed,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Plus,
  Settings,
  Trash2,
} from "lucide-react";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../../convex/_generated/api").api;
import { Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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

// ============================================================================
// Types
// ============================================================================

interface WorkspaceViewProps {
  workspaceId: Id<"kbWorkspaces">;
  initialWorkspace: {
    _id: Id<"kbWorkspaces">;
    name: string;
    slug: string;
    description?: string;
    icon?: string;
    userPermission: "none" | "read" | "write" | "admin" | null;
  };
}

interface Folder {
  _id: Id<"kbFolders">;
  name: string;
  icon?: string;
  displayOrder: number;
  isArchived: boolean;
  createdAt: number;
}

// ============================================================================
// Folder Card Component
// ============================================================================

interface FolderCardProps {
  folder: Folder;
  workspaceId: Id<"kbWorkspaces">;
  canWrite: boolean;
  onArchive: (folderId: Id<"kbFolders">) => Promise<void>;
}

function FolderCard({
  folder,
  workspaceId,
  canWrite,
  onArchive,
}: FolderCardProps): React.ReactElement {
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
// Loading Skeleton
// ============================================================================

function WorkspaceViewSkeleton(): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* Breadcrumb skeleton */}
      <Skeleton className="h-5 w-48" />

      {/* Header skeleton */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <Skeleton className="size-16 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Folders skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-24" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-20 w-full" />
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
// Workspace View Component
// ============================================================================

/**
 * Client-side view component for a workspace.
 *
 * Displays:
 * - Workspace header with name, description, and icon
 * - Folder grid (root-level folders)
 * - Document list (root-level documents)
 * - Create folder/document actions
 */
export function WorkspaceView({
  workspaceId,
  initialWorkspace,
}: WorkspaceViewProps): React.ReactElement {
  // Real-time workspace data
  const workspace = useQuery(api.knowledge.workspaces.get, { id: workspaceId });

  // Root-level folders
  const folders = useQuery(api.knowledge.folders.list, {
    workspaceId,
    parentId: undefined, // Root level
  });

  // Mutations
  const createFolder = useMutation(api.knowledge.folders.create);
  const archiveFolder = useMutation(api.knowledge.folders.archive);

  // Permissions
  const currentWorkspace = workspace ?? initialWorkspace;
  const canWrite =
    currentWorkspace.userPermission === "write" ||
    currentWorkspace.userPermission === "admin";

  // Handlers
  const handleCreateFolder = async (): Promise<void> => {
    try {
      await createFolder({
        name: "New Folder",
        workspaceId,
      });
      toast.success("Folder created");
    } catch {
      toast.error("Failed to create folder");
    }
  };

  const handleArchiveFolder = async (folderId: Id<"kbFolders">): Promise<void> => {
    try {
      await archiveFolder({ id: folderId });
      toast.success("Folder archived");
    } catch {
      toast.error("Failed to archive folder");
    }
  };

  // Loading state (folders only since we have initial workspace data)
  if (folders === undefined) {
    return <WorkspaceViewSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/knowledge">Knowledge Base</Link>} />
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{currentWorkspace.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Workspace Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {currentWorkspace.icon ? (
              <span className="text-2xl">{currentWorkspace.icon}</span>
            ) : (
              <BookOpen className="size-8" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              {currentWorkspace.name}
            </h1>
            {currentWorkspace.description && (
              <p className="text-muted-foreground">
                {currentWorkspace.description}
              </p>
            )}
          </div>
        </div>
        {canWrite && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleCreateFolder}>
              <FolderPlus className="mr-2 size-4" />
              New Folder
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" />}>
                <Settings className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>
                  <Pencil className="mr-2 size-4" />
                  Edit Workspace
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 size-4" />
                  Archive Workspace
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Folders Section */}
      <section aria-labelledby="folders-heading">
        <div className="mb-4 flex items-center justify-between">
          <h2
            id="folders-heading"
            className="text-lg font-semibold text-foreground"
          >
            Folders
          </h2>
        </div>

        {folders.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <FolderClosed className="size-8 text-muted-foreground" />
              <p className="mt-2 text-sm text-muted-foreground">
                No folders yet. Create one to organize your documents.
              </p>
              {canWrite && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={handleCreateFolder}
                >
                  <Plus className="mr-2 size-4" />
                  Create Folder
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {folders.map((folder: Folder) => (
              <FolderCard
                key={folder._id}
                folder={folder}
                workspaceId={workspaceId}
                canWrite={canWrite}
                onArchive={handleArchiveFolder}
              />
            ))}
          </div>
        )}
      </section>

      {/* Note about documents - KB documents require a folder */}
      <section aria-labelledby="docs-note-heading">
        <Card className="border-dashed bg-muted/30">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="flex size-10 items-center justify-center rounded-lg bg-muted">
              <FileText className="size-5 text-muted-foreground" />
            </div>
            <div>
              <h3 id="docs-note-heading" className="font-medium">
                Documents
              </h3>
              <p className="text-sm text-muted-foreground">
                Documents are organized within folders. Select a folder to view
                and create documents.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
