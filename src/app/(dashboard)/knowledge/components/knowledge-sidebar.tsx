"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  FolderClosed,
  FolderOpen,
  Home,
  Plus,
  Settings,
} from "lucide-react";

// Load API reference using require to avoid Convex's deep type instantiation issue (TS2589)
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const api: any = require("../../../../../convex/_generated/api").api;
import { Id } from "../../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// ============================================================================
// Types
// ============================================================================

interface KnowledgeSidebarProps {
  /** Callback when navigation occurs (used to close mobile sidebar) */
  onNavigate?: () => void;
}

interface FolderTreeNode {
  _id: Id<"kbFolders">;
  name: string;
  icon?: string;
  displayOrder: number;
  isArchived: boolean;
  children: FolderTreeNode[];
}

interface Workspace {
  _id: Id<"kbWorkspaces">;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  userPermission: "none" | "read" | "write" | "admin" | null;
}

// ============================================================================
// Folder Tree Item Component
// ============================================================================

interface FolderTreeItemProps {
  folder: FolderTreeNode;
  workspaceId: Id<"kbWorkspaces">;
  level: number;
  onNavigate?: () => void;
}

function FolderTreeItem({
  folder,
  workspaceId,
  level,
  onNavigate,
}: FolderTreeItemProps): React.ReactElement {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = React.useState(false);
  const hasChildren = folder.children.length > 0;

  // Check if this folder or any child is active
  const isActive = pathname.includes(`/${folder._id}`);

  // Auto-expand if a child is active
  React.useEffect(() => {
    if (pathname.includes(`/${folder._id}`) && hasChildren) {
      setIsOpen(true);
    }
  }, [pathname, folder._id, hasChildren]);

  const handleClick = (): void => {
    onNavigate?.();
  };

  return (
    <div>
      <div className="flex items-center">
        {hasChildren ? (
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <div className="flex w-full items-center">
              <CollapsibleTrigger
                className="flex size-5 shrink-0 items-center justify-center rounded-md hover:bg-accent"
                aria-label={isOpen ? "Collapse folder" : "Expand folder"}
              >
                {isOpen ? (
                  <ChevronDown className="size-3" />
                ) : (
                  <ChevronRight className="size-3" />
                )}
              </CollapsibleTrigger>
              <Link
                href={`/knowledge/${workspaceId}/${folder._id}`}
                onClick={handleClick}
                className={cn(
                  "flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                  isActive && "bg-accent text-accent-foreground"
                )}
              >
                {isOpen ? (
                  <FolderOpen className="size-4 shrink-0 text-muted-foreground" />
                ) : (
                  <FolderClosed className="size-4 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate">{folder.icon ?? ""} {folder.name}</span>
              </Link>
            </div>
            <CollapsibleContent>
              <div className="ml-4 border-l pl-2">
                {folder.children.map((child) => (
                  <FolderTreeItem
                    key={child._id}
                    folder={child}
                    workspaceId={workspaceId}
                    level={level + 1}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        ) : (
          <Link
            href={`/knowledge/${workspaceId}/${folder._id}`}
            onClick={handleClick}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 pl-7 text-sm transition-colors hover:bg-accent",
              isActive && "bg-accent text-accent-foreground"
            )}
          >
            <FolderClosed className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{folder.icon ?? ""} {folder.name}</span>
          </Link>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Workspace Section Component
// ============================================================================

interface WorkspaceSectionProps {
  workspace: Workspace;
  onNavigate?: () => void;
}

function WorkspaceSection({
  workspace,
  onNavigate,
}: WorkspaceSectionProps): React.ReactElement {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = React.useState(true);

  // Query folder tree for this workspace
  const folderTree = useQuery(api.knowledge.folders.getTree, {
    workspaceId: workspace._id,
  });

  const createFolder = useMutation(api.knowledge.folders.create);

  const isWorkspaceActive = pathname.includes(`/knowledge/${workspace._id}`);

  // Auto-expand if workspace is active
  React.useEffect(() => {
    if (isWorkspaceActive) {
      setIsOpen(true);
    }
  }, [isWorkspaceActive]);

  const handleCreateFolder = async (): Promise<void> => {
    try {
      await createFolder({
        name: "New Folder",
        workspaceId: workspace._id,
      });
      toast.success("Folder created");
    } catch {
      toast.error("Failed to create folder");
    }
  };

  const canWrite =
    workspace.userPermission === "write" ||
    workspace.userPermission === "admin";

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center justify-between pr-2">
        <CollapsibleTrigger
          className={cn(
            "flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium transition-colors hover:bg-accent",
            isWorkspaceActive && "text-primary"
          )}
        >
          {isOpen ? (
            <ChevronDown className="size-4 shrink-0" />
          ) : (
            <ChevronRight className="size-4 shrink-0" />
          )}
          <BookOpen className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {workspace.icon ?? ""} {workspace.name}
          </span>
        </CollapsibleTrigger>
        {canWrite && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-xs"
                  className="size-5 shrink-0 opacity-0 group-hover:opacity-100 focus:opacity-100"
                  aria-label="Add to workspace"
                />
              }
            >
              <Plus className="size-3" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCreateFolder}>
                <FolderClosed className="mr-2 size-4" />
                New Folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      <CollapsibleContent>
        <div className="ml-4 mt-1 space-y-0.5 border-l pl-2">
          {/* Workspace root link */}
          <Link
            href={`/knowledge/${workspace._id}`}
            onClick={() => onNavigate?.()}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
              pathname === `/knowledge/${workspace._id}` &&
                "bg-accent text-accent-foreground"
            )}
          >
            <Home className="size-4 shrink-0 text-muted-foreground" />
            <span>Overview</span>
          </Link>

          {/* Folder tree loading state */}
          {folderTree === undefined && (
            <div className="space-y-1 py-1">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-6 w-5/6" />
            </div>
          )}

          {/* Folder tree */}
          {folderTree &&
            folderTree.map((folder: FolderTreeNode) => (
              <FolderTreeItem
                key={folder._id}
                folder={folder}
                workspaceId={workspace._id}
                level={0}
                onNavigate={onNavigate}
              />
            ))}

          {/* Empty state */}
          {folderTree && folderTree.length === 0 && (
            <div className="px-2 py-2 text-xs text-muted-foreground">
              No folders yet
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ============================================================================
// Knowledge Sidebar Component
// ============================================================================

/**
 * Sidebar navigation component for the Knowledge Base.
 *
 * Features:
 * - Workspace switcher with collapsible sections
 * - Folder tree navigation
 * - Quick actions (create workspace, folder, document)
 * - Responsive design (Sheet on mobile, fixed on desktop)
 */
export function KnowledgeSidebar({
  onNavigate,
}: KnowledgeSidebarProps): React.ReactElement {
  const pathname = usePathname();
  const workspaces = useQuery(api.knowledge.workspaces.list, {});
  const createWorkspace = useMutation(api.knowledge.workspaces.create);

  const handleCreateWorkspace = async (): Promise<void> => {
    try {
      const slug = `workspace-${Date.now()}`;
      await createWorkspace({
        name: "New Workspace",
        slug,
      });
      toast.success("Workspace created");
    } catch {
      toast.error("Failed to create workspace");
    }
  };

  const isLoading = workspaces === undefined;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <Link
          href="/knowledge"
          onClick={() => onNavigate?.()}
          className="flex items-center gap-2 font-semibold text-foreground hover:text-primary transition-colors"
        >
          <FileText className="size-5" />
          <span>Knowledge Base</span>
        </Link>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleCreateWorkspace}
          aria-label="Create new workspace"
        >
          <Plus className="size-4" />
        </Button>
      </div>

      {/* Navigation */}
      <ScrollArea className="flex-1">
        <nav className="space-y-1 p-2" aria-label="Knowledge Base navigation">
          {/* Home link */}
          <Link
            href="/knowledge"
            onClick={() => onNavigate?.()}
            className={cn(
              "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
              pathname === "/knowledge" && "bg-accent text-accent-foreground"
            )}
          >
            <Home className="size-4 shrink-0 text-muted-foreground" />
            <span>Home</span>
          </Link>

          {/* Divider */}
          <div className="my-2 border-t" />

          {/* Workspaces Section */}
          <div className="space-y-1">
            <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Workspaces
            </div>

            {/* Loading state */}
            {isLoading && (
              <div className="space-y-2 px-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-3/4" />
              </div>
            )}

            {/* Workspace list */}
            {workspaces && workspaces.length > 0 && (
              <div className="space-y-1">
                {workspaces.map((workspace: Workspace) => (
                  <div key={workspace._id} className="group">
                    <WorkspaceSection
                      workspace={workspace}
                      onNavigate={onNavigate}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {workspaces && workspaces.length === 0 && (
              <div className="px-2 py-4 text-center">
                <p className="text-sm text-muted-foreground">
                  No workspaces yet
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={handleCreateWorkspace}
                >
                  <Plus className="mr-2 size-4" />
                  Create Workspace
                </Button>
              </div>
            )}
          </div>
        </nav>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t p-2">
        <Link
          href="/knowledge/settings"
          onClick={() => onNavigate?.()}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
            pathname === "/knowledge/settings" &&
              "bg-accent text-accent-foreground"
          )}
        >
          <Settings className="size-4 shrink-0 text-muted-foreground" />
          <span>Settings</span>
        </Link>
      </div>
    </div>
  );
}
