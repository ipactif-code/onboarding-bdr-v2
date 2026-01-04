"use client";

import * as React from "react";
import Link from "next/link";
import { useQuery, useMutation } from "convex/react";
import {
  BookOpen,
  Clock,
  FileText,
  FolderOpen,
  Plus,
  Star,
} from "lucide-react";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../convex/_generated/api").api;
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

// ============================================================================
// Types
// ============================================================================

interface Workspace {
  _id: Id<"kbWorkspaces">;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  userPermission: "none" | "read" | "write" | "admin" | null;
  _creationTime: number;
}

// ============================================================================
// Workspace Card Component
// ============================================================================

interface WorkspaceCardProps {
  workspace: Workspace;
}

function WorkspaceCard({ workspace }: WorkspaceCardProps): React.ReactElement {
  return (
    <Link href={`/knowledge/${workspace._id}`}>
      <Card className="group cursor-pointer transition-all hover:border-primary hover:shadow-md">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {workspace.icon ? (
              <span className="text-lg">{workspace.icon}</span>
            ) : (
              <BookOpen className="size-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <CardTitle className="truncate text-base group-hover:text-primary transition-colors">
              {workspace.name}
            </CardTitle>
          </div>
        </CardHeader>
        {workspace.description && (
          <CardContent className="pt-0">
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {workspace.description}
            </p>
          </CardContent>
        )}
      </Card>
    </Link>
  );
}

// ============================================================================
// Quick Actions Section
// ============================================================================

interface QuickActionsProps {
  onCreateWorkspace: () => Promise<void>;
  isCreating: boolean;
}

function QuickActions({
  onCreateWorkspace,
  isCreating,
}: QuickActionsProps): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-2 sm:grid-cols-2">
        <Button
          variant="outline"
          className="h-auto justify-start gap-3 p-4"
          onClick={onCreateWorkspace}
          disabled={isCreating}
        >
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <FolderOpen className="size-5" />
          </div>
          <div className="text-left">
            <div className="font-medium">Create Workspace</div>
            <div className="text-xs text-muted-foreground">
              Start a new knowledge space
            </div>
          </div>
        </Button>
        <Button
          variant="outline"
          className="h-auto justify-start gap-3 p-4"
          disabled
        >
          <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-muted-foreground">
            <FileText className="size-5" />
          </div>
          <div className="text-left">
            <div className="font-medium">Create Document</div>
            <div className="text-xs text-muted-foreground">
              Select a folder first
            </div>
          </div>
        </Button>
      </CardContent>
    </Card>
  );
}

// ============================================================================
// Empty State Component
// ============================================================================

interface EmptyStateProps {
  onCreateWorkspace: () => Promise<void>;
  isCreating: boolean;
}

function EmptyState({
  onCreateWorkspace,
  isCreating,
}: EmptyStateProps): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-muted">
        <BookOpen className="size-8 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">Welcome to Knowledge Base</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Create your first workspace to start organizing your team&apos;s
        documentation, guides, and knowledge resources.
      </p>
      <Button className="mt-6" onClick={onCreateWorkspace} disabled={isCreating}>
        <Plus className="mr-2 size-4" />
        Create Your First Workspace
      </Button>
    </div>
  );
}

// ============================================================================
// Loading Skeleton
// ============================================================================

function KnowledgeHomeViewSkeleton(): React.ReactElement {
  return (
    <div className="space-y-6">
      {/* Header skeleton */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Quick actions skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>

      {/* Workspaces skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      </div>

      {/* Recents skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-48" />
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Knowledge Home View Component
// ============================================================================

/**
 * Client-side view component for the Knowledge Base home page.
 *
 * Displays:
 * - Welcome message
 * - Quick actions (create workspace, document)
 * - All accessible workspaces
 * - Recent documents (placeholder for future implementation)
 * - Favorite documents (placeholder for future implementation)
 */
export function KnowledgeHomeView(): React.ReactElement {
  const [isCreating, setIsCreating] = React.useState(false);
  const workspaces = useQuery(api.knowledge.workspaces.list, {});
  const createWorkspace = useMutation(api.knowledge.workspaces.create);

  const handleCreateWorkspace = async (): Promise<void> => {
    setIsCreating(true);
    try {
      const slug = `workspace-${Date.now()}`;
      await createWorkspace({
        name: "New Workspace",
        slug,
        description: "A new knowledge workspace",
      });
      toast.success("Workspace created successfully");
    } catch {
      toast.error("Failed to create workspace");
    } finally {
      setIsCreating(false);
    }
  };

  // Loading state
  if (workspaces === undefined) {
    return <KnowledgeHomeViewSkeleton />;
  }

  // Empty state
  if (workspaces.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Knowledge Base
          </h1>
          <p className="text-muted-foreground">
            Your team&apos;s central hub for documentation and knowledge sharing
          </p>
        </div>
        <EmptyState
          onCreateWorkspace={handleCreateWorkspace}
          isCreating={isCreating}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            Knowledge Base
          </h1>
          <p className="text-muted-foreground">
            Your team&apos;s central hub for documentation and knowledge sharing
          </p>
        </div>
        <Button onClick={handleCreateWorkspace} disabled={isCreating}>
          <Plus className="mr-2 size-4" />
          New Workspace
        </Button>
      </div>

      {/* Quick Actions */}
      <QuickActions
        onCreateWorkspace={handleCreateWorkspace}
        isCreating={isCreating}
      />

      {/* Workspaces Grid */}
      <section aria-labelledby="workspaces-heading">
        <h2
          id="workspaces-heading"
          className="mb-4 text-lg font-semibold text-foreground"
        >
          Your Workspaces
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((workspace: Workspace) => (
            <WorkspaceCard key={workspace._id} workspace={workspace} />
          ))}
        </div>
      </section>

      {/* Recent Documents - Placeholder for future implementation */}
      <section aria-labelledby="recents-heading">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="size-5 text-muted-foreground" />
          <h2
            id="recents-heading"
            className="text-lg font-semibold text-foreground"
          >
            Recently Edited
          </h2>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Clock className="size-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Your recently edited documents will appear here
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Favorites - Placeholder for future implementation */}
      <section aria-labelledby="favorites-heading">
        <div className="flex items-center gap-2 mb-4">
          <Star className="size-5 text-muted-foreground" />
          <h2
            id="favorites-heading"
            className="text-lg font-semibold text-foreground"
          >
            Favorites
          </h2>
        </div>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-8 text-center">
            <Star className="size-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">
              Star documents to add them to your favorites
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
